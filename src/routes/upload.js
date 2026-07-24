import { isBlocked, safeRelPath, safeProj, normalizeUploadPath, sha256Hex, sha256Bytes } from '../security.js';
import { listProjectFiles, putFile } from '../storage.js';
import { jsonResponse, writeCorsHeaders, checkAuth } from '../helpers.js';
import { LIMITS } from '../config.js';

export async function postUpload(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';

  if (!env.TINYHUB_TOKEN || !checkAuth(request, env)) {
    return new Response('Unauthorized: Token not configured or invalid', { status: 401, headers: corsHeaders });
  }

  const proj = safeProj(request.params.proj);
  if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

  const formData = await request.formData();
  const baseTip = formData.get('baseTip')?.toString();

  if (baseTip) {
    const currentTip = await env.DB.prepare(
      "SELECT hash12 FROM commits WHERE user = ? AND proj = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 1"
    ).bind(USER, proj).first();
    if (currentTip && currentTip.hash12 !== baseTip) {
      return jsonResponse({
        error: 'conflict',
        message: 'Remote has newer commits. Refresh and retry.',
        remoteTip: currentTip.hash12,
        yourTip: baseTip,
      }, 409, corsHeaders);
    }
  }

  let mode = (formData.get('mode') || 'push').toString().toLowerCase();
  if (!['push', 'merge', 'replace'].includes(mode)) mode = 'push';
  let message = (formData.get('message') || '').toString().trim();
  const incremental = formData.get('incremental') === '1';
  let explicitDeletes = [];
  try {
    explicitDeletes = JSON.parse(formData.get('deletes') || '[]');
  } catch (e) {
    explicitDeletes = [];
  }

  const tNew = new Map();
  const blocked = [];
  let encodings = {};
  try {
    encodings = JSON.parse(formData.get('encodings') || '{}');
  } catch (e) {
    encodings = {};
  }

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const normPath = normalizeUploadPath(value.name, proj);
      if (!normPath) continue;
      if (isBlocked(normPath)) {
        blocked.push(normPath);
        continue;
      }
      if (value.size > LIMITS.MAX_FILE_SIZE) {
        return jsonResponse({ error: `File too large: ${value.name} exceeds 50MB limit` }, 413, corsHeaders);
      }
      let bytes;
      if (encodings[normPath] === 'gzip') {
        const ds = new DecompressionStream('gzip');
        const stream = value.stream().pipeThrough(ds);
        const buf = await new Response(stream).arrayBuffer();
        bytes = new Uint8Array(buf);
      } else {
        const buf = await value.arrayBuffer();
        bytes = new Uint8Array(buf);
      }
      tNew.set(normPath, bytes);
    }
  }

  if (tNew.size === 0 && !incremental && mode !== 'push') {
    return new Response('No files uploaded', { status: 400, headers: corsHeaders });
  }
  if (incremental && tNew.size === 0 && explicitDeletes.length === 0) {
    return new Response('No files uploaded', { status: 400, headers: corsHeaders });
  }

  if (mode === 'replace') {
    const oldFiles = await listProjectFiles(env.FILES, USER, proj);
    if (oldFiles.length > 0) {
      const keys = oldFiles.map(f => `projects/${USER}/${proj}/${f.path}`);
      for (let i = 0; i < keys.length; i += LIMITS.R2_DELETE_BATCH) {
        await env.FILES.delete(keys.slice(i, i + LIMITS.R2_DELETE_BATCH));
      }
    }
  }

  const prefix = `projects/${USER}/${proj}/`;
  const oldHashes = new Map();
  const currentPaths = [];
  if (mode !== 'replace') {
    const oldFiles = await listProjectFiles(env.FILES, USER, proj);
    for (const f of oldFiles) {
      currentPaths.push(f.path);
      if (f.sha256) {
        oldHashes.set(f.path, f.sha256);
      }
    }
  }

  const added = [];
  const modified = [];
  const deleted = [];
  const saved = [];
  const writePromises = [];

  for (const [path, bytes] of tNew.entries()) {
    const sha = await sha256Bytes(bytes);
    const oldSha = oldHashes.get(path);
    if (!oldSha) {
      added.push(path);
    } else if (oldSha !== sha) {
      modified.push(path);
    } else {
      continue;
    }
    writePromises.push(putFile(env.FILES, `projects/${USER}/${proj}/${path}`, bytes, { sha256: sha, lines: String(new TextDecoder('utf-8', { fatal: false }).decode(bytes).split('\n').length) }));
    saved.push(path);
  }

  if (incremental) {
    if (explicitDeletes.length > 0) {
      deleted.push(...explicitDeletes);
    }
  } else if (mode === 'push') {
    const toDelete = currentPaths.filter(p => !tNew.has(p));
    if (toDelete.length > 0) {
      deleted.push(...toDelete);
    }
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
  const commitMsg = message || `Push: +${stats.added} ~${stats.modified} -${stats.deleted}`;

  // 1. D1-First Strategy: Insert pending commit and commit_files
  const batchStatements = [
    env.DB.prepare(
      'INSERT INTO commits (id, user, proj, hash12, parent_hash12, author, message, stats_json, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(commitId, USER, proj, commitHash, parentHash12, 'Andie', commitMsg, JSON.stringify(stats), Date.now(), 'pending')
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
    mode,
    blocked,
    saved,
    deleted,
    commit: {
      hash: commitHash,
      message: commitMsg,
      author: 'Andie',
      stats,
      changes: { added, modified, deleted }
    },
    stats,
    changes: { added, modified, deleted }
  }, 200, corsHeaders);
}
