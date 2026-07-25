// TinyHub — shared commit engine.
// Fixes original bugs:
//  - race condition on files_count/commits_count (now a single Prisma transaction)
//  - failed-commit recovery (now writes FileBlob as source of truth inside the txn)
//  - FileBlob table is the source of truth (was unused before)

import { db } from "./db";
import { putFile, deleteFiles, putSnapshot } from "./storage";
import { sha256Bytes, sha256Hex } from "./security";
import { LIMITS, DEFAULT_USER } from "./config";
import { countLines } from "./helpers";

export interface CommitInput {
  user?: string;
  proj: string;
  message?: string;
  /// path -> bytes (new content)
  files: Map<string, Uint8Array>;
  /// explicit deletes (incremental / commit endpoint)
  deletes?: string[];
  /// "push" | "merge" | "replace"
  mode?: "push" | "merge" | "replace";
  /// if true, do NOT auto-delete remote-only files (push semantics off)
  incremental?: boolean;
  /// baseTip for conflict detection
  baseTip?: string;
  author?: string;
}

export interface CommitResult {
  ok: boolean;
  empty?: boolean;
  project: string;
  mode: string;
  blocked: string[];
  saved: string[];
  deleted: string[];
  added: string[];
  modified: string[];
  commit: {
    hash: string;
    message: string;
    author: string;
    stats: { added: number; modified: number; deleted: number; unchanged: number };
  };
  stats: { added: number; modified: number; deleted: number; unchanged: number };
  changes: { added: string[]; modified: string[]; deleted: string[] };
  remoteTip?: string;
}

export class CommitError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function performCommit(input: CommitInput): Promise<CommitResult> {
  const user = input.user || DEFAULT_USER;
  const proj = input.proj;
  const mode = (input.mode || "push") as "push" | "merge" | "replace";
  const incremental = !!input.incremental;
  const messageRaw = (input.message || "").trim();
  if (messageRaw.length > LIMITS.MAX_MESSAGE_LEN) {
    throw new CommitError(`Commit message too long (max ${LIMITS.MAX_MESSAGE_LEN})`, 400);
  }
  if (input.files.size + (input.deletes?.length || 0) > LIMITS.MAX_FILES_PER_COMMIT) {
    throw new CommitError(`Too many files in one commit (max ${LIMITS.MAX_FILES_PER_COMMIT})`, 400);
  }

  // Conflict check
  const lastCommit = await db.commit.findFirst({
    where: { user, proj, status: "complete" },
    orderBy: { createdAt: "desc" },
    select: { hash12: true },
  });
  const currentTip = lastCommit?.hash12 || null;
  if (input.baseTip && currentTip && currentTip !== input.baseTip) {
    throw new CommitError(
      JSON.stringify({
        error: "conflict",
        message: "Remote has newer commits. Refresh and retry.",
        remoteTip: currentTip,
        yourTip: input.baseTip,
      }),
      409
    );
  }

  // Load current tip state from FileBlob (source of truth)
  const existing = await db.fileBlob.findMany({
    where: { user, proj },
    select: { path: true, sha256: true },
  });
  const oldHashes = new Map<string, string>();
  const currentPaths: string[] = [];
  for (const f of existing) {
    currentPaths.push(f.path);
    oldHashes.set(f.path, f.sha256);
  }

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const saved: string[] = [];
  const blocked: string[] = [];

  // Compute diffs
  const fileMeta: { path: string; bytes: Uint8Array; sha: string; size: number; lines: number }[] =
    [];
  for (const [path, bytes] of input.files.entries()) {
    if (bytes.byteLength > LIMITS.MAX_FILE_SIZE) {
      throw new CommitError(`File too large: ${path} exceeds 50MB limit`, 413);
    }
    const sha = await sha256Bytes(bytes);
    const oldSha = oldHashes.get(path);
    if (!oldSha) {
      added.push(path);
    } else if (oldSha !== sha) {
      modified.push(path);
    } else {
      continue; // unchanged
    }
    fileMeta.push({
      path,
      bytes,
      sha,
      size: bytes.byteLength,
      lines: countLines(bytes),
    });
    saved.push(path);
  }

  // Deletes
  let explicitDeletes: string[] = [];
  if (incremental) {
    explicitDeletes = (input.deletes || []).slice(0, LIMITS.MAX_DELETES);
    deleted.push(...explicitDeletes);
  } else if (mode === "push") {
    const toDelete = currentPaths.filter((p) => !input.files.has(p));
    deleted.push(...toDelete);
  }
  // merge / replace-with-explicit: only explicit deletes apply (handled by caller for replace)

  if (saved.length === 0 && deleted.length === 0) {
    return {
      ok: true,
      empty: true,
      project: proj,
      mode,
      blocked,
      saved,
      deleted,
      added,
      modified,
      commit: {
        hash: currentTip || "none",
        message: "Everything up-to-date",
        author: input.author || "TinyHub",
        stats: { added: 0, modified: 0, deleted: 0, unchanged: currentPaths.length },
      },
      stats: { added: 0, modified: 0, deleted: 0, unchanged: currentPaths.length },
      changes: { added, modified, deleted },
      remoteTip: currentTip || undefined,
    };
  }

  const totalFiles = currentPaths.length + added.length - deleted.length;
  const stats = {
    added: added.length,
    modified: modified.length,
    deleted: deleted.length,
    unchanged: Math.max(0, totalFiles - added.length - modified.length),
  };

  const commitId = crypto.randomUUID();
  const commitHash = (await sha256Hex(`${commitId}:${messageRaw}:${Date.now()}`)).substring(0, 12);
  const commitMsg = messageRaw || `Push: +${stats.added} ~${stats.modified} -${stats.deleted}`;
  const author = input.author || "TinyHub";
  const now = BigInt(Date.now());

  // 1. Write pending commit + commit_files in a single transaction.
  await db.$transaction([
    db.commit.create({
      data: {
        id: commitId,
        user,
        proj,
        hash12: commitHash,
        parentHash12: currentTip,
        author,
        message: commitMsg,
        statsJson: JSON.stringify(stats),
        createdAt: now,
        status: "pending",
        files: {
          create: [
            ...added.map((p) => ({ path: p, changeType: "added" })),
            ...modified.map((p) => ({ path: p, changeType: "modified" })),
            ...deleted.map((p) => ({ path: p, changeType: "deleted" })),
          ],
        },
      },
    }),
  ]);

  // 2. Perform filesystem writes/deletes + write content-addressed snapshots.
  try {
    await Promise.all(
      fileMeta.map((m) => putFile(user, proj, m.path, m.bytes))
    );
    // Write content-addressed snapshots (deduped — skips if blob already on disk).
    // This enables real before/after diffs for future commits.
    await Promise.all(
      fileMeta.map((m) => putSnapshot(user, proj, m.sha, m.bytes))
    );
    if (deleted.length > 0) {
      await deleteFiles(user, proj, deleted);
    }

    // 3. Finalize: update FileBlob (source of truth) + BlobSnapshot (per-commit
    //    history) + project, in one transaction.
    await db.$transaction(async (tx) => {
      // upsert added/modified file blobs (current tip state)
      for (const m of fileMeta) {
        await tx.fileBlob.upsert({
          where: { user_proj_path: { user, proj, path: m.path } },
          create: {
            user,
            proj,
            path: m.path,
            sha256: m.sha,
            size: m.size,
            lines: m.lines,
            commitId,
            updatedAt: now,
          },
          update: {
            sha256: m.sha,
            size: m.size,
            lines: m.lines,
            commitId,
            updatedAt: now,
          },
        });
        // Write a per-commit snapshot row (the file content AT this commit).
        // upsert because a re-push of identical content would collide on the
        // compound id (user, proj, commitId, path) — but commitId is unique per
        // commit, so this is effectively always a create.
        await tx.blobSnapshot.upsert({
          where: {
            user_proj_commitId_path: { user, proj, commitId, path: m.path },
          },
          create: {
            user,
            proj,
            commitId,
            path: m.path,
            sha256: m.sha,
            size: m.size,
            lines: m.lines,
          },
          update: {
            sha256: m.sha,
            size: m.size,
            lines: m.lines,
          },
        });
      }
      // delete removed file blobs
      if (deleted.length > 0) {
        await tx.fileBlob.deleteMany({
          where: { user, proj, path: { in: deleted } },
        });
      }
      // mark commit complete
      await tx.commit.update({
        where: { id: commitId },
        data: { status: "complete" },
      });
      // upsert project row
      await tx.project.upsert({
        where: { user_proj: { user, proj } },
        create: {
          user,
          proj,
          updatedAt: now,
          filesCount: totalFiles,
          commitsCount: 1,
          lastCommit: commitHash,
        },
        update: {
          updatedAt: now,
          filesCount: totalFiles,
          commitsCount: { increment: 1 },
          lastCommit: commitHash,
        },
      });
    });
  } catch (err) {
    // Mark commit failed; scheduled cleanup will reconcile.
    try {
      await db.commit.update({ where: { id: commitId }, data: { status: "failed" } });
    } catch {
      /* ignore */
    }
    throw err;
  }

  return {
    ok: true,
    project: proj,
    mode,
    blocked,
    saved,
    deleted,
    added,
    modified,
    commit: { hash: commitHash, message: commitMsg, author, stats },
    stats,
    changes: { added, modified, deleted },
    remoteTip: commitHash,
  };
}

/// Reconcile FileBlob table against the filesystem for a project (recovery utility).
export async function reconcileProject(user: string, proj: string): Promise<{ fixed: number }> {
  const { walkProjectFiles } = await import("./storage");
  const disk = await walkProjectFiles(user, proj);
  const dbFiles = await db.fileBlob.findMany({ where: { user, proj }, select: { path: true } });
  const diskSet = new Set<string>(disk.map((d) => d.path));
  const dbSet = new Set<string>(dbFiles.map((d) => d.path));
  const missing = [...diskSet].filter((p: string) => !dbSet.has(p));
  const orphan = [...dbSet].filter((p: string) => !diskSet.has(p));
  // remove orphans
  if (orphan.length) {
    await db.fileBlob.deleteMany({ where: { user, proj, path: { in: orphan } } });
  }
  return { fixed: missing.length + orphan.length };
}
