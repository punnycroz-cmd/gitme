// TinyHub — filesystem storage layer (mirrors the original R2 layout).
// Key format: projects/<user>/<proj>/<relpath>
// All access goes through safeRelPath/safeProj to prevent traversal.

import { promises as fs } from "fs";
import path from "path";
import { isBlocked, safeProj, safeRelPath } from "./security";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");

export function storageRoot(): string {
  return STORAGE_ROOT;
}

/// Absolute path on disk for a given (user, proj, relpath). Returns null if unsafe.
export function resolveKey(user: string, proj: string, relPath: string): string | null {
  const p = safeProj(proj);
  const r = safeRelPath(relPath);
  if (!p || !r || isBlocked(r)) return null;
  // user is server-controlled but still sanitize.
  const safeUser = user.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeUser) return null;
  return path.join(STORAGE_ROOT, "projects", safeUser, p, r);
}

export async function putFile(
  user: string,
  proj: string,
  relPath: string,
  bytes: Uint8Array
): Promise<boolean> {
  const abs = resolveKey(user, proj, relPath);
  if (!abs) return false;
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, bytes);
  return true;
}

export async function getFile(
  user: string,
  proj: string,
  relPath: string
): Promise<Uint8Array | null> {
  const abs = resolveKey(user, proj, relPath);
  if (!abs) return null;
  try {
    const buf = await fs.readFile(abs);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function getFileText(
  user: string,
  proj: string,
  relPath: string
): Promise<string | null> {
  const bytes = await getFile(user, proj, relPath);
  if (!bytes) return null;
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function deleteFiles(user: string, proj: string, relPaths: string[]): Promise<void> {
  await Promise.all(
    relPaths.map(async (p) => {
      const abs = resolveKey(user, proj, p);
      if (!abs) return;
      try {
        await fs.unlink(abs);
      } catch {
        /* ignore */
      }
    })
  );
}

export interface StoredFileMeta {
  path: string;
  size: number;
}

/// Walk the project directory and return all file metas (rel paths).
/// Used as a fallback / reconciliation; the FileBlob table is the primary source of truth.
export async function walkProjectFiles(user: string, proj: string): Promise<StoredFileMeta[]> {
  const p = safeProj(proj);
  if (!p) return [];
  const safeUser = user.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeUser) return [];
  const root = path.join(STORAGE_ROOT, "projects", safeUser, p);
  const out: StoredFileMeta[] = [];
  async function recurse(dir: string) {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await recurse(full);
      } else if (e.isFile()) {
        const rel = path.relative(root, full).split(path.sep).join("/");
        if (!isBlocked(rel)) {
          try {
            const stat = await fs.stat(full);
            out.push({ path: rel, size: stat.size });
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  await recurse(root);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

// ─── Content-addressed snapshot storage (for per-commit blob snapshots) ──────
// Snapshots are stored at storage/snapshots/<user>/<proj>/<sha256>.
// Deduped: identical content across commits reuses the same on-disk file.

function snapshotPath(user: string, proj: string, sha256: string): string | null {
  const p = safeProj(proj);
  if (!p) return null;
  const safeUser = user.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeUser) return null;
  // sha256 is hex; validate to prevent traversal.
  if (!/^[a-f0-9]{64}$/.test(sha256)) return null;
  return path.join(STORAGE_ROOT, "snapshots", safeUser, p, sha256);
}

/// Write a snapshot blob (deduped — skips if already on disk).
export async function putSnapshot(
  user: string,
  proj: string,
  sha256: string,
  bytes: Uint8Array
): Promise<boolean> {
  const abs = snapshotPath(user, proj, sha256);
  if (!abs) return false;
  try {
    // Dedup: if the file already exists, don't rewrite it.
    await fs.access(abs);
    return true;
  } catch {
    /* not present — write it */
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, bytes);
  return true;
}

/// Read a snapshot blob as text. Returns null if not found.
export async function getSnapshotText(
  user: string,
  proj: string,
  sha256: string
): Promise<string | null> {
  const abs = snapshotPath(user, proj, sha256);
  if (!abs) return null;
  try {
    return await fs.readFile(abs, "utf-8");
  } catch {
    return null;
  }
}

/// Delete ALL snapshot blobs for a project (GC on reset/delete).
/// Removes the storage/snapshots/<user>/<proj>/ directory entirely.
/// Returns the number of files removed (best-effort count).
export async function deleteAllSnapshots(
  user: string,
  proj: string
): Promise<number> {
  const p = safeProj(proj);
  if (!p) return 0;
  const safeUser = user.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeUser) return 0;
  const dir = path.join(STORAGE_ROOT, "snapshots", safeUser, p);
  let count = 0;
  async function recurse(d: string) {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        await recurse(full);
      } else {
        try {
          await fs.unlink(full);
          count++;
        } catch {
          /* ignore */
        }
      }
    }
  }
  await recurse(dir);
  // Remove the now-empty project snapshot directory (and empty parents).
  try {
    await fs.rmdir(dir);
  } catch {
    /* not empty or missing — ignore */
  }
  return count;
}

