import { isBlocked, safeRelPath, safeProj, sha256Hex, sha256Bytes } from '../security.js';
import { listProjectFiles, putFile } from '../storage.js';
import { jsonResponse, writeCorsHeaders, checkAuth } from '../helpers.js';
import { LIMITS } from '../config.js';

export async function postCommit(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';

  if (!env.TINYHUB_TOKEN || !checkAuth(request, env)) {
    return new Response('Unauthorized: Token not configured or invalid', { status: 401, headers: corsHeaders });
  }

  const proj = safeProj(request.params.proj);
  if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

  const bodyText = await request.text();
  if (bodyText.length > LIMITS.MAX_FILE_SIZE) {
    return new Response('Payload Too Large', { status: 413, headers: corsHeaders });
  }
  const body = JSON.parse(bodyText);
  const { message, files, deletes } = body || {};

  const oldFiles = await listProjectFiles(env.FILES, USER, proj);
  const oldHashes = new Map();
  const currentPaths = [];
  for (const f of oldFiles) {
    currentPaths.push(f.path);
    if (f.sha256) {
      oldHashes.set(f.path, f.sha256);
    }
  }

  const added = [];
  const modified = [];
  const deleted = [];
  const saved = [];
  const writePromises = [];

  for (const [path, content] of Object.entries(files || {})) {
    const safePath = safeRelPath(path);
    if (!safePath || isBlocked(safePath)) continue;
    const bytes = new TextEncoder().encode(content);
    const sha = await sha256Bytes(bytes);
    const oldSha = oldHashes.get(safePath);
    if (!oldSha) {
      added.push(safePath);
    } else if (oldSha !== sha) {
      modified.push(safePath);
    } else {
      continue;
    }
    writePromises.push(putFile(env.FILES, `projects/${USER}/${proj}/${safePath}`, bytes, { sha256: sha, lines: String(new TextDecoder('utf-8', { fatal: false }).decode(bytes).split('\n').length) }));
    saved.push(safePath);
  }

  for (const path of deletes || []) {
    const safePath = safeRelPath(path);
    if (!safePath || isBlocked(safePath)) continue;
    deleted.push(safePath);
  }

  if (saved.length === 0 && deleted.length === 0) {
    return jsonResponse({ ok: true, empty: true, message: 'Everything up-to-date', project: proj }, 200, corsHeaders);
  }

  const totalFiles = currentPaths.length + added.length - deleted.length;
  const stats = {
    added: added.length,
    modified: modified.length,
    deleted: deleted.length,
    unchanged: totalFiles - added.length - modified.length
  };

  const lastCommitRow = await env.DB.prepare(
    "SELECT hash12 FROM commits WHERE user = ? AND proj = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 1"
  ).bind(USER, proj).first();
  const parentHash12 = lastCommitRow?.hash12 || null;

  const commitId = crypto.randomUUID();
  const commitHash = (await sha256Hex(`${commitId}:${message}:${Date.now()}`)).substring(0, 12);
  const commitMsg = message || `Update: +${stats.added} ~${stats.modified} -${stats.deleted}`;

  // 1. D1-First Strategy: Insert pending commit and commit_files
  const batchStatements = [
    env.DB.prepare(
      'INSERT INTO commits (id, user, proj, hash12, parent_hash12, author, message, stats_json, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(commitId, USER, proj, commitHash, parentHash12, 'Meta AI', commitMsg, JSON.stringify(stats), Date.now(), 'pending')
  ];

  for (const p of added) {
    batchStatements.push(
      env.DB.prepare('INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)')
        .bind(commitId, p, 'added')
    );
  }
  for (const p of modified) {
    batchStatements.push(
      env.DB.prepare('INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)')
        .bind(commitId, p, 'modified')
    );
  }
  for (const p of deleted) {
    batchStatements.push(
      env.DB.prepare('INSERT INTO commit_files (commit_id, path, change_type) VALUES (?, ?, ?)')
        .bind(commitId, p, 'deleted')
    );
  }

  await env.DB.batch(batchStatements);

  try {
    // 2. Perform R2 writes and deletes concurrently
    await Promise.all(writePromises);

    if (deleted.length > 0) {
      const keys = deleted.map(p => `projects/${USER}/${proj}/${p}`);
      for (let i = 0; i < keys.length; i += LIMITS.R2_DELETE_BATCH) {
        await env.FILES.delete(keys.slice(i, i + LIMITS.R2_DELETE_BATCH));
      }
    }

    // 3. Mark commit as complete and update projects atomic commits count
    const completeStatements = [
      env.DB.prepare(
        "UPDATE commits SET status = 'complete' WHERE id = ?"
      ).bind(commitId),
      env.DB.prepare(
        'INSERT INTO projects (user, proj, updated_at, files_count, commits_count) VALUES (?, ?, ?, ?, 1) ' +
        'ON CONFLICT(user, proj) DO UPDATE SET updated_at = excluded.updated_at, files_count = excluded.files_count, commits_count = projects.commits_count + 1'
      ).bind(USER, proj, Math.floor(Date.now() / 1000), totalFiles)
    ];

    await env.DB.batch(completeStatements);
  } catch (err) {
    // Fallback: If R2 or finalize fails, mark commit as failed
    try {
      await env.DB.prepare(
        "UPDATE commits SET status = 'failed' WHERE id = ?"
      ).bind(commitId).run();
    } catch (dbErr) {
      console.error('Failed to mark commit as failed:', dbErr);
    }
    throw err;
  }

  return jsonResponse({
    ok: true,
    project: proj,
    commit: {
      hash: commitHash,
      message: commitMsg,
      author: 'Meta AI',
      stats,
      changes: { added, modified, deleted }
    },
    stats,
    changes: { added, modified, deleted }
  }, 200, corsHeaders);
}
