// src/index.js
import { isBlocked, safeRelPath, safeProj, normalizeUploadPath, sha256Hex, sha256Bytes } from './security.js';
import { listProjectFiles, getFileMeta, putFile } from './storage.js';

const DUMP_MAX_FILES = 200;
const DUMP_MAX_FILE_SIZE = 512 * 1024;
const DUMP_MAX_TOTAL = 8 * 1024 * 1024;

const MIME_MAP = {
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  cjs: 'text/javascript; charset=utf-8',
  ts: 'text/plain; charset=utf-8',
  tsx: 'text/plain; charset=utf-8',
  jsx: 'text/plain; charset=utf-8',
  py: 'text/x-python; charset=utf-8',
  json: 'application/json; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  html: 'text/plain; charset=utf-8',
  css: 'text/css; charset=utf-8',
  toml: 'text/plain; charset=utf-8',
  yml: 'text/yaml; charset=utf-8',
  yaml: 'text/yaml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  rules: 'text/plain; charset=utf-8',
  firebaserc: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
};

function guessContentType(filePath) {
  const base = filePath.split('/').pop() || filePath;
  if (base === '.firebaserc' || base === '.npmrc') return 'application/json; charset=utf-8';
  if (base === '.gitignore' || base === '.gitattributes' || base === '.editorconfig' || base === '_redirects') {
    return 'text/plain; charset=utf-8';
  }
  const ext = (base.includes('.') ? base.split('.').pop() : '').toLowerCase();
  return MIME_MAP[ext] || 'text/plain; charset=utf-8';
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const colors = {
    js: '#f1e05a', ts: '#3178c6', html: '#e34c26', css: '#563d7c',
    md: '#4f46e5', json: '#e88800', py: '#3572A5', png: '#10b981',
    jpg: '#10b981', jpeg: '#10b981', gif: '#10b981', svg: '#06b6d4'
  };
  const color = colors[ext] || '#9ca3af';
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
}

function wantsJson(request, searchParams) {
  const format = (searchParams.get('format') || '').toLowerCase();
  if (format === 'json' || format === 'api') return true;
  if (searchParams.get('json') === '1' || searchParams.get('json') === 'true') return true;
  const accept = (request.headers.get('Accept') || '').toLowerCase();
  if (accept.includes('application/json')) return true;
  const ua = (request.headers.get('User-Agent') || '').toLowerCase();
  if (ua.includes('curl/') || ua.includes('python-requests') || ua.includes('httpx') || ua.includes('go-http-client')) {
    return true;
  }
  return false;
}

function jsonResponse(body, status, corsHeaders, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      ...extraHeaders
    }
  });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function checkAuth(request, env) {
  const token = env.TINYHUB_TOKEN;
  if (!token) return false;
  const authHeader = request.headers.get('Authorization') || '';
  const expectedAuth = `Bearer ${token}`;
  return timingSafeEqual(authHeader, expectedAuth);
}

function writeCorsHeaders(request) {
  const base = {
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  };
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const requestHost = new URL(request.url).host;
      if (originHost === requestHost) {
        return { 'Access-Control-Allow-Origin': origin, ...base };
      }
    } catch { }
  }
  return base;
}

function buildStructuredTree(paths, sizes = {}) {
  const dirSet = new Set();
  for (const p of paths) {
    const segs = p.split('/');
    for (let i = 1; i < segs.length; i++) {
      dirSet.add(segs.slice(0, i).join('/'));
    }
  }
  const tree = [
    ...[...dirSet].sort().map((path) => ({ path, type: 'tree' })),
    ...paths.slice().sort().map((path) => ({ path, type: 'blob', size: sizes[path] ?? null })),
  ];
  return { paths, tree };
}

async function handleDump(user, proj, request, env, corsHeaders, forceJson = false) {
  const url = new URL(request.url);
  const { searchParams } = url;

  const mode = searchParams.get('mode'); // null | 'delta'
  const since = searchParams.get('since'); // hash12 or 'last' or null
  const pathFilter = searchParams.get('path'); // e.g. 'public'
  const includeUnchanged = searchParams.get('includeUnchanged') === '1' || searchParams.get('includeUnchanged') === 'true';

  let cleanPathFilter = null;
  if (pathFilter) {
    cleanPathFilter = safeRelPath(pathFilter);
    if (!cleanPathFilter || isBlocked(cleanPathFilter)) {
      return new Response('Invalid path filter', { status: 400, headers: corsHeaders });
    }
  }

  const lastCommit = await env.DB.prepare(
    'SELECT id, hash12, parent_hash12, message, stats_json FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(user, proj).first();

  let changed = [];
  let isDeltaMode = false;
  let bannerMessage = '';
  const hasCommits = lastCommit ? true : false;

  if (mode === 'delta') {
    if (hasCommits) {
      isDeltaMode = true;
      if (since) {
        const sinceCommit = await env.DB.prepare('SELECT id, hash12, created_at FROM commits WHERE hash12 = ? AND user = ? AND proj = ?').bind(since, user, proj).first();
        if (sinceCommit) {
          const commitsResult = await env.DB.prepare('SELECT id, hash12 FROM commits WHERE user = ? AND proj = ? AND created_at >= ?').bind(user, proj, sinceCommit.created_at).all();
          const commitIds = commitsResult.results.filter(c => c.hash12 !== sinceCommit.hash12).map(c => c.id);
          if (commitIds.length > 0) {
            const placeholders = commitIds.map(() => '?').join(',');
            const filesResult = await env.DB.prepare(`SELECT path, change_type FROM commit_files WHERE commit_id IN (${placeholders})`).bind(...commitIds).all();

            const pathMap = new Map();
            for (const row of filesResult.results) {
              const prev = pathMap.get(row.path);
              if (row.change_type === 'deleted') {
                if (prev === 'added') pathMap.delete(row.path);
                else pathMap.set(row.path, 'deleted');
              } else if (row.change_type === 'added') {
                pathMap.set(row.path, 'added');
              } else { // modified
                if (prev !== 'added') pathMap.set(row.path, 'modified');
              }
            }
            changed = [...pathMap.entries()].map(([path, change_type]) => ({ path, change_type }));
          } else {
            changed = [];
          }
        } else {
          const filesResult = await env.DB.prepare('SELECT path, change_type FROM commit_files WHERE commit_id = ?').bind(lastCommit.id).all();
          changed = filesResult.results;
          bannerMessage = `Commit ${since} not found; showing changes from last commit instead.`;
        }
      } else {
        const filesResult = await env.DB.prepare('SELECT path, change_type FROM commit_files WHERE commit_id = ?').bind(lastCommit.id).all();
        changed = filesResult.results;
      }
    } else {
      bannerMessage = 'No previous commit found; showing full repository dump instead.';
    }
  }

  const allPaths = await listProjectFiles(env.FILES, user, proj);
  let filteredPaths = allPaths;
  if (cleanPathFilter) {
    const cleanFilter = cleanPathFilter.replace(/\/$/, '');
    const prefix = cleanFilter + '/';
    filteredPaths = allPaths.filter(p => p.startsWith(prefix) || p === cleanFilter);
  }

  const addedSet = new Set();
  const modifiedSet = new Set();
  const deletedSet = new Set();

  for (const f of changed) {
    if (cleanPathFilter) {
      const cleanFilter = cleanPathFilter.replace(/\/$/, '');
      const prefix = cleanFilter + '/';
      if (!f.path.startsWith(prefix) && f.path !== cleanFilter) continue;
    }
    if (f.change_type === 'added') addedSet.add(f.path);
    else if (f.change_type === 'modified') modifiedSet.add(f.path);
    else if (f.change_type === 'deleted') deletedSet.add(f.path);
  }

  let filesToShow = [];
  let deletedFiles = [];
  let unchangedFiles = [];

  if (isDeltaMode) {
    filesToShow = filteredPaths.filter(p => addedSet.has(p) || modifiedSet.has(p));
    deletedFiles = [...deletedSet].sort();
    unchangedFiles = filteredPaths.filter(p => !addedSet.has(p) && !modifiedSet.has(p));
  } else {
    filesToShow = filteredPaths;
    deletedFiles = [];
    unchangedFiles = [];
  }

  const R2_CONCURRENCY = 8;
  const files = {};
  const skipped = [];
  let totalBytes = 0;
  let fileCount = 0;
  const ALWAYS_INCLUDE = new Set(['wrangler.toml']);

  for (let i = 0; i < filesToShow.length; i += R2_CONCURRENCY) {
    const batch = filesToShow.slice(i, i + R2_CONCURRENCY);
    await Promise.all(
      batch.map(async (path) => {
        try {
          const meta = await getFileMeta(env.FILES, `projects/${user}/${proj}/${path}`);
          const size = meta?.size || 0;

          if (fileCount >= DUMP_MAX_FILES && !ALWAYS_INCLUDE.has(path)) {
            skipped.push({ path, reason: 'max_files' });
            return;
          }
          if (size > DUMP_MAX_FILE_SIZE && !ALWAYS_INCLUDE.has(path)) {
            skipped.push({ path, reason: 'too_large', size });
            return;
          }

          const object = await env.FILES.get(`projects/${user}/${proj}/${path}`);
          if (!object) {
            skipped.push({ path, reason: 'missing' });
            return;
          }

          const buf = await object.arrayBuffer();
          if (totalBytes + buf.byteLength > DUMP_MAX_TOTAL && !ALWAYS_INCLUDE.has(path)) {
            skipped.push({ path, reason: 'total_budget' });
            return;
          }

          const bytes = new Uint8Array(buf);
          const ext = path.split('.').pop().toLowerCase();
          const binary = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'zip', 'gz', 'woff', 'woff2', 'ttf', 'eot', 'mp3', 'mp4', 'wasm', 'bin'].includes(ext) || bytes.includes(0);

          if (binary) {
            skipped.push({ path, reason: 'binary' });
            return;
          }

          const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
          files[path] = content;
          totalBytes += buf.byteLength;
          fileCount++;
        } catch (e) {
          skipped.push({ path, reason: 'error', error: e.message });
        }
      })
    );
  }

  const deltaStats = {
    added: addedSet.size,
    modified: modifiedSet.size,
    deleted: deletedSet.size,
    unchanged: unchangedFiles.length
  };

  // JSON output
  if (forceJson || wantsJson(request, searchParams)) {
    return jsonResponse({
      repo: `${user}/${proj}`,
      type: isDeltaMode ? 'delta' : 'dump',
      commit: lastCommit?.hash12 || null,
      parent: lastCommit?.parent_hash12 || null,
      stats: isDeltaMode ? deltaStats : { added: filesToShow.length, modified: 0, deleted: 0, unchanged: 0 },
      fileCount: Object.keys(files).length,
      totalBytes,
      files,
      deleted: deletedFiles,
      skipped,
      unchanged: includeUnchanged ? unchangedFiles : undefined,
      urls: {
        html: `/dump/${user}/${proj}/${url.search}`,
        browser: `/p/${user}/${proj}/`
      }
    }, 200, corsHeaders);
  }

  // HTML output
  const templateRes = await env.ASSETS.fetch(new Request(new URL('/dump-template.html', request.url)));
  if (!templateRes.ok) return new Response('Dump template not found', { status: 500 });
  let tmpl = await templateRes.text();

  let textDump = '';
  if (isDeltaMode) {
    textDump += `// TinyHub delta: ${user}/${proj}\n`;
    textDump += `// commit: ${lastCommit?.hash12 || 'none'} parent: ${lastCommit?.parent_hash12 || 'none'}\n`;
    textDump += `// message: ${lastCommit?.message || 'none'}\n`;
    textDump += `// stats: +${deltaStats.added} ~${deltaStats.modified} -${deltaStats.deleted}\n\n`;
  } else {
    textDump += `// TinyHub repository dump: ${user}/${proj}\n`;
    textDump += `// total files: ${filesToShow.length}\n\n`;
  }

  for (const [path, content] of Object.entries(files)) {
    textDump += `// File: ${path}\n`;
    textDump += content + '\n\n';
  }

  for (const path of deletedFiles) {
    textDump += `// Deleted: ${path}\n\n`;
  }

  if (unchangedFiles.length > 0) {
    const listLimit = 50;
    const truncatedList = unchangedFiles.slice(0, listLimit).join(', ');
    const extraCount = unchangedFiles.length - listLimit;
    const suffix = extraCount > 0 ? `, ... and ${extraCount} more` : '';
    textDump += `// Unchanged (${unchangedFiles.length} files not included): ${truncatedList}${suffix}\n`;
  }

  let chipsHtml = '<div class="dump-chips">';
  if (isDeltaMode) {
    chipsHtml += `<span class="dump-chip">+${deltaStats.added} ~${deltaStats.modified} -${deltaStats.deleted}</span>`;
    chipsHtml += `<span class="dump-chip">${(totalBytes / 1024).toFixed(1)} KB</span>`;
    chipsHtml += `<span class="dump-chip">commit ${lastCommit?.hash12 || 'none'}</span>`;
  } else {
    chipsHtml += `<span class="dump-chip">${filesToShow.length} files</span>`;
    chipsHtml += `<span class="dump-chip">${(totalBytes / 1024).toFixed(1)} KB</span>`;
    chipsHtml += `<span class="dump-chip">commit ${lastCommit?.hash12 || 'none'}</span>`;
  }
  chipsHtml += '</div>';

  let bannerHtml = '';
  if (isDeltaMode) {
    bannerHtml = `
      <div class="dump-banner delta-banner">
        ${bannerMessage ? `<p style="margin-bottom: 8px; color: var(--accent-secondary); font-weight: 600;">⚠️ ${escapeHtml(bannerMessage)}</p>` : ''}
        <p><strong>Copy-paste prompt for AI chat:</strong></p>
        <pre style="background: var(--bg-glass-inset); padding: 12px; border-radius: 8px; margin-top: 8px; font-family: ui-monospace, monospace; white-space: pre-wrap; font-size: 12px; color: var(--text);">Baseline was full project earlier.
Here are only files changed since last push (<code>${lastCommit?.hash12 || 'none'}</code>).
Unchanged files still exist, don't rewrite them unless needed.
Reply only with changed files using <code>// File: path</code></pre>
      </div>
    `;
  } else {
    bannerHtml = `
      <div class="dump-banner">
        ${bannerMessage ? `<p style="margin-bottom: 8px; color: var(--accent-secondary); font-weight: 600;">⚠️ ${escapeHtml(bannerMessage)}</p>` : ''}
        <p>This page contains all project files with their full content.
          Copy-paste the entire page (or click "Copy All") into an AI chat for instant access to every file.</p>
      </div>
    `;
  }

  let sectionsHtml = '';
  for (const [path, content] of Object.entries(files)) {
    const icon = getFileIcon(path);
    sectionsHtml += `<section class="dump-section"><div class="dump-path">${icon}<span>${escapeHtml(path)}</span></div><div class="dump-code"><pre><code>${escapeHtml(content)}</code></pre></div></section>`;
  }
  for (const path of deletedFiles) {
    sectionsHtml += `<section class="dump-section" style="opacity: 0.6;"><div class="dump-path" style="text-decoration: line-through;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span>${escapeHtml(path)} (deleted)</span></div><div class="dump-code" style="padding: 12px; font-style: italic; color: var(--text-muted);">// File removed</div></section>`;
  }
  if (includeUnchanged && unchangedFiles.length > 0) {
    sectionsHtml += `<section class="dump-section"><div class="dump-path"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg><span>Unchanged Files (${unchangedFiles.length})</span></div><div class="dump-code"><pre><code>${escapeHtml(unchangedFiles.join('\n'))}</code></pre></div></section>`;
  }

  if (!sectionsHtml) {
    sectionsHtml = '<div class="dump-empty">No changed files found in this project.</div>';
  }

  let metaHtml = `${fileCount} files shown`;
  if (skipped.length) metaHtml += ` · ${skipped.length} skipped`;
  metaHtml += ` · ${totalBytes.toLocaleString()} bytes`;

  const title = `TinyHub — ${user}/${proj} (${isDeltaMode ? 'delta' : 'dump'})`;
  tmpl = tmpl.replace('<!-- SSR_TITLE -->', escapeHtml(title));
  tmpl = tmpl.replace('<!-- SSR_DUMP_CHIPS -->', chipsHtml);
  tmpl = tmpl.replace('<!-- SSR_DUMP_BANNER -->', bannerHtml);
  tmpl = tmpl.replace('<!-- SSR_DUMP_CONTENT -->', `<div class="dump-meta">${escapeHtml(metaHtml)}</div>${sectionsHtml}`);
  tmpl = tmpl.replace('<!-- SSR_BROWSER_URL -->', `/p/${user}/${proj}/`);
  tmpl = tmpl.replace('<!-- SSR_RAW_DUMP_TEXT -->', escapeHtml(textDump));
  tmpl = tmpl.replace('<!-- SSR_COMMIT_HASH -->', lastCommit?.hash12 || 'none');

  const etag = `"${lastCommit?.hash12 || 'none'}-${totalBytes}"`;

  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, ...corsHeaders } });
  }

  return new Response(tmpl, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'ETag': etag,
      'X-TinyHub-Commit': lastCommit?.hash12 || 'none',
      'X-TinyHub-Parent': lastCommit?.parent_hash12 || 'none'
    }
  });
}

const rateBuckets = new Map();

function checkRateLimit(ip, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(ip, b);
  }
  b.count++;
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (now > v.resetAt) rateBuckets.delete(k);
    }
  }
  return b.count <= limit;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    const { searchParams } = url;
    const USER = env.TINYHUB_USER || 'andie';

    const corsHeaders = writeCorsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const isWrite = ['POST', 'PUT', 'DELETE'].includes(request.method);
    if (isWrite && !checkRateLimit(ip)) {
      return jsonResponse({ error: 'Too Many Requests' }, 429, corsHeaders);
    }

    const method = request.method === 'HEAD' ? 'GET' : request.method;

    try {
      // 0. GET /api/health
      if (method === 'GET' && pathname === '/api/health') {
        return jsonResponse({ status: 'ok', user: USER, timestamp: Date.now() }, 200, corsHeaders);
      }

      // 1. GET /api/config
      if (method === 'GET' && pathname === '/api/config') {
        return jsonResponse({ apiBase: "", user: USER }, 200, corsHeaders);
      }

      // 2. GET /api/projects
      if (method === 'GET' && pathname === '/api/projects') {
        const { results } = await env.DB.prepare(
          'SELECT proj, updated_at, files_count, commits_count FROM projects WHERE user = ? ORDER BY updated_at DESC'
        ).bind(USER).all();

        const list = results.map(row => ({
          name: row.proj,
          updatedAt: row.updated_at,
          filesCount: row.files_count,
          commitsCount: row.commits_count
        }));

        return jsonResponse(list, 200, corsHeaders);
      }

      // GET /api/tip/:proj
      if (method === 'GET' && pathname.startsWith('/api/tip/')) {
        const proj = safeProj(pathname.substring('/api/tip/'.length));
        if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });
        const last = await env.DB.prepare(
          'SELECT hash12, created_at FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(USER, proj).first();
        return jsonResponse({ commit: last?.hash12 || null, created_at: last?.created_at || null }, 200, corsHeaders);
      }

      // 3. GET /api/tree/:proj
      if (method === 'GET' && pathname.startsWith('/api/tree/')) {
        const proj = safeProj(pathname.substring('/api/tree/'.length));
        if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

        const wantMeta = searchParams.get('meta') === '1' || searchParams.get('meta') === 'true';
        const wantFlat = searchParams.get('flat') === '1' || searchParams.get('flat') === 'true';

        const lastCommit = await env.DB.prepare(
          'SELECT hash12 FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(USER, proj).first();

        const commitHash = lastCommit?.hash12 || 'none';
        const etag = `"${commitHash}-${wantMeta ? 'meta' : wantFlat ? 'flat' : 'tree'}"`;

        if (request.headers.get('If-None-Match') === etag) {
          return new Response(null, { status: 304, headers: { ...corsHeaders, 'ETag': etag } });
        }

        const paths = await listProjectFiles(env.FILES, USER, proj);

        if (wantFlat) {
          return jsonResponse(paths, 200, corsHeaders, { 'ETag': etag });
        }

        if (wantMeta) {
          const fileList = [];
          for (const path of paths) {
            const meta = await getFileMeta(env.FILES, `projects/${USER}/${proj}/${path}`);
            fileList.push({
              path,
              size: meta?.size || 0,
              sha256: meta?.sha256 || null
            });
          }
          return jsonResponse({
            repo: `${USER}/${proj}`,
            project: proj,
            commit: commitHash,
            files: fileList,
            count: fileList.length
          }, 200, corsHeaders, { 'ETag': etag });
        }

        const { tree } = buildStructuredTree(paths);
        return jsonResponse({
          repo: `${USER}/${proj}`,
          project: proj,
          files: paths,
          tree,
          count: paths.length
        }, 200, corsHeaders, { 'ETag': etag });
      }

      // GET /api/file/:proj
      if (method === 'GET' && pathname.startsWith('/api/file/')) {
        const proj = safeProj(pathname.substring('/api/file/'.length));
        if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });
        const filePath = safeRelPath(searchParams.get('path') || '');
        if (!filePath || isBlocked(filePath)) return new Response('Invalid path', { status: 400, headers: corsHeaders });
        const object = await env.FILES.get(`projects/${USER}/${proj}/${filePath}`);
        if (!object) return new Response('Not Found', { status: 404, headers: corsHeaders });
        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', guessContentType(filePath));
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return new Response(object.body, { headers });
      }

      // 4. GET /api/history/:proj
      if (method === 'GET' && pathname.startsWith('/api/history/')) {
        const proj = safeProj(pathname.substring('/api/history/'.length));
        if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

        const { results: commits } = await env.DB.prepare(
          'SELECT id, hash12, author, message, stats_json, created_at FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 50'
        ).bind(USER, proj).all();

        const filesByCommit = new Map();
        if (commits.length > 0) {
          const commitIds = commits.map(c => c.id);
          const placeholders = commitIds.map(() => '?').join(',');
          const { results: allFiles } = await env.DB.prepare(
            `SELECT commit_id, path, change_type FROM commit_files WHERE commit_id IN (${placeholders})`
          ).bind(...commitIds).all();
          for (const f of allFiles) {
            if (!filesByCommit.has(f.commit_id)) filesByCommit.set(f.commit_id, []);
            filesByCommit.get(f.commit_id).push(f);
          }
        }

        const history = [];
        for (const c of commits) {
          const files = filesByCommit.get(c.id) || [];
          const changes = { added: [], modified: [], deleted: [] };
          for (const f of files) {
            if (f.change_type === 'added') changes.added.push(f.path);
            else if (f.change_type === 'modified') changes.modified.push(f.path);
            else if (f.change_type === 'deleted') changes.deleted.push(f.path);
          }

          history.push({
            hash: c.hash12,
            author: c.author,
            date: new Date(c.created_at * 1000).toISOString(),
            message: c.message,
            stats: JSON.parse(c.stats_json),
            changes
          });
        }

        return jsonResponse(history, 200, corsHeaders);
      }

      // 5. POST /api/upload/:proj
      if (method === 'POST' && pathname.startsWith('/api/upload/')) {
        const corsHeaders = writeCorsHeaders(request);
        if (env.TINYHUB_TOKEN && !checkAuth(request, env)) {
          return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }

        const proj = safeProj(pathname.substring('/api/upload/'.length));
        if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

        const formData = await request.formData();
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
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit
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
            if (value.size > MAX_FILE_SIZE) {
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
          const oldPaths = await listProjectFiles(env.FILES, USER, proj);
          if (oldPaths.length > 0) {
            const keys = oldPaths.map(p => `projects/${USER}/${proj}/${p}`);
            for (let i = 0; i < keys.length; i += 1000) {
              await env.FILES.delete(keys.slice(i, i + 1000));
            }
          }
        }

        const prefix = `projects/${USER}/${proj}/`;
        const oldHashes = new Map();
        const currentPaths = [];
        if (mode !== 'replace') {
          let listResult = await env.FILES.list({ prefix });
          let allObjects = [...listResult.objects];
          while (listResult.truncated) {
            listResult = await env.FILES.list({ prefix, cursor: listResult.cursor });
            allObjects.push(...listResult.objects);
          }
          for (const obj of allObjects) {
            const relPath = obj.key.replace(prefix, '');
            if (!relPath || isBlocked(relPath)) continue;
            currentPaths.push(relPath);
            if (obj.customMetadata?.sha256) {
              oldHashes.set(relPath, obj.customMetadata.sha256);
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
          }
          writePromises.push(putFile(env.FILES, `projects/${USER}/${proj}/${path}`, bytes, { sha256: sha }));
          saved.push(path);
        }
        await Promise.all(writePromises);

        if (incremental) {
          if (explicitDeletes.length > 0) {
            const keys = explicitDeletes.map(p => `projects/${USER}/${proj}/${p}`);
            for (let i = 0; i < keys.length; i += 1000) {
              await env.FILES.delete(keys.slice(i, i + 1000));
            }
            deleted.push(...explicitDeletes);
          }
        } else if (mode === 'push') {
          const toDelete = currentPaths.filter(p => !tNew.has(p));
          if (toDelete.length > 0) {
            const keys = toDelete.map(p => `projects/${USER}/${proj}/${p}`);
            for (let i = 0; i < keys.length; i += 1000) {
              await env.FILES.delete(keys.slice(i, i + 1000));
            }
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
          'SELECT hash12 FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(USER, proj).first();
        const parentHash12 = lastCommitRow?.hash12 || null;

        const commitId = crypto.randomUUID();
        const commitHash = (await sha256Hex(`${commitId}:${message}:${Date.now()}`)).substring(0, 12);
        const commitMsg = message || `Push: +${stats.added} ~${stats.modified} -${stats.deleted}`;

        const commitsCountResult = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM commits WHERE user = ? AND proj = ?'
        ).bind(USER, proj).first();

        const batchStatements = [
          env.DB.prepare(
            'INSERT INTO commits (id, user, proj, hash12, parent_hash12, author, message, stats_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(commitId, USER, proj, commitHash, parentHash12, 'Andie', commitMsg, JSON.stringify(stats), Math.floor(Date.now() / 1000))
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

        batchStatements.push(
          env.DB.prepare(
            'INSERT INTO projects (user, proj, updated_at, files_count, commits_count) VALUES (?, ?, ?, ?, ?) ' +
            'ON CONFLICT(user, proj) DO UPDATE SET updated_at = excluded.updated_at, files_count = excluded.files_count, commits_count = excluded.commits_count'
          ).bind(USER, proj, Math.floor(Date.now() / 1000), totalFiles, commitsCountResult.count)
        );

        await env.DB.batch(batchStatements);

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

      // 6. POST /api/commit/:proj
      if (method === 'POST' && pathname.startsWith('/api/commit/')) {
        const corsHeaders = writeCorsHeaders(request);
        if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        const proj = safeProj(pathname.substring('/api/commit/'.length));
        if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

        const bodyText = await request.text();
        if (bodyText.length > 10 * 1024 * 1024) {
          return new Response('Payload Too Large', { status: 413, headers: corsHeaders });
        }
        const body = JSON.parse(bodyText);
        const { message, files, deletes } = body || {};

        const prefix = `projects/${USER}/${proj}/`;
        let listResult = await env.FILES.list({ prefix });
        let allObjects = [...listResult.objects];
        while (listResult.truncated) {
          listResult = await env.FILES.list({ prefix, cursor: listResult.cursor });
          allObjects.push(...listResult.objects);
        }

        const oldHashes = new Map();
        const currentPaths = [];
        for (const obj of allObjects) {
          const relPath = obj.key.replace(prefix, '');
          if (!relPath || isBlocked(relPath)) continue;
          currentPaths.push(relPath);
          if (obj.customMetadata?.sha256) {
            oldHashes.set(relPath, obj.customMetadata.sha256);
          }
        }

        const added = [];
        const modified = [];
        const deleted = [];
        const saved = [];

        for (const [path, content] of Object.entries(files || {})) {
          const safePath = safeRelPath(path);
          if (!safePath || isBlocked(safePath)) continue;
          const bytes = new TextEncoder().encode(content);
          const sha = await sha256Bytes(bytes);
          const oldSha = oldHashes.get(safePath);
          if (!oldSha) added.push(safePath);
          else if (oldSha !== sha) modified.push(safePath);
          await putFile(env.FILES, `projects/${USER}/${proj}/${safePath}`, bytes, { sha256: sha });
          saved.push(safePath);
        }

        for (const path of deletes || []) {
          const safePath = safeRelPath(path);
          if (!safePath || isBlocked(safePath)) continue;
          await env.FILES.delete(`projects/${USER}/${proj}/${safePath}`);
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
          'SELECT hash12 FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(USER, proj).first();
        const parentHash12 = lastCommitRow?.hash12 || null;

        const commitId = crypto.randomUUID();
        const commitHash = (await sha256Hex(`${commitId}:${message}:${Date.now()}`)).substring(0, 12);
        const commitMsg = message || `Update: +${stats.added} ~${stats.modified} -${stats.deleted}`;

        const commitsCountResult = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM commits WHERE user = ? AND proj = ?'
        ).bind(USER, proj).first();

        const batchStatements = [
          env.DB.prepare(
            'INSERT INTO commits (id, user, proj, hash12, parent_hash12, author, message, stats_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(commitId, USER, proj, commitHash, parentHash12, 'Meta AI', commitMsg, JSON.stringify(stats), Math.floor(Date.now() / 1000))
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

        batchStatements.push(
          env.DB.prepare(
            'INSERT INTO projects (user, proj, updated_at, files_count, commits_count) VALUES (?, ?, ?, ?, ?) ' +
            'ON CONFLICT(user, proj) DO UPDATE SET updated_at = excluded.updated_at, files_count = excluded.files_count, commits_count = excluded.commits_count'
          ).bind(USER, proj, Math.floor(Date.now() / 1000), totalFiles, commitsCountResult.count)
        );

        await env.DB.batch(batchStatements);

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

      // 7. POST /api/reset/:proj
      if (method === 'POST' && pathname.startsWith('/api/reset/')) {
        const corsHeaders = writeCorsHeaders(request);
        if (!checkAuth(request, env)) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        const proj = safeProj(pathname.substring('/api/reset/'.length));
        if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });

        const paths = await listProjectFiles(env.FILES, USER, proj);
        if (paths.length > 0) {
          const keys = paths.map(p => `projects/${USER}/${proj}/${p}`);
          for (let i = 0; i < keys.length; i += 1000) {
            await env.FILES.delete(keys.slice(i, i + 1000));
          }
        }

        // Single-batch D1 cleanup
        await env.DB.batch([
          env.DB.prepare(
            'DELETE FROM commit_files WHERE commit_id IN (SELECT id FROM commits WHERE user = ? AND proj = ?)'
          ).bind(USER, proj),
          env.DB.prepare('DELETE FROM commits WHERE user = ? AND proj = ?').bind(USER, proj),
          env.DB.prepare('DELETE FROM projects WHERE user = ? AND proj = ?').bind(USER, proj)
        ]);

        return jsonResponse({ ok: true, project: proj, deleted: paths.length, message: `Wiped ${paths.length} files and D1 records` }, 200, corsHeaders);
      }

      // GET /api/bundle/:proj
      if (method === 'GET' && pathname.startsWith('/api/bundle/')) {
        const proj = safeProj(pathname.substring('/api/bundle/'.length));
        if (!proj) return new Response('Invalid project name', { status: 400, headers: corsHeaders });
        return await handleDump(USER, proj, request, env, corsHeaders, true);
      }

      // 8. GET /r/:user/:proj/*
      if (method === 'GET' && pathname.startsWith('/r/')) {
        const rest = pathname.substring('/r/'.length);
        const segs = rest.split('/').filter(Boolean);
        const user = segs[0];
        const proj = safeProj(segs[1]);
        const filepath = safeRelPath(segs.slice(2).join('/'));

        if (user !== USER || !proj || !filepath || isBlocked(filepath)) {
          return new Response('Not Found', { status: 404, headers: corsHeaders });
        }

        const object = await env.FILES.get(`projects/${USER}/${proj}/${filepath}`);
        if (!object) return new Response('Not Found', { status: 404, headers: corsHeaders });

        const headers = new Headers(corsHeaders);
        headers.set('Content-Type', guessContentType(filepath));
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

        return new Response(object.body, { headers });
      }

      // 9. GET /p/:user/:proj/
      if (method === 'GET' && pathname.startsWith('/p/')) {
        const rest = pathname.substring('/p/'.length);
        const segs = rest.split('/').filter(Boolean);
        const user = segs[0];
        const proj = safeProj(segs[1]);
        const filepath = safeRelPath(segs.slice(2).join('/')) || '';

        if (user !== USER || !proj) {
          return new Response('Not Found', { status: 404, headers: corsHeaders });
        }

        const templateRes = await env.ASSETS.fetch(new Request(new URL('/browser-template.html', request.url)));
        if (!templateRes.ok) return new Response('Template not found', { status: 500 });
        let htmlContent = await templateRes.text();

        const paths = await listProjectFiles(env.FILES, USER, proj);

        // buildNestedTree and renderNestedTree logic
        const buildNestedTree = (items) => {
          const root = {};
          for (const f of items) {
            const parts = f.split('/');
            let curr = root;
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              if (i === parts.length - 1) {
                curr[part] = null;
              } else {
                if (!curr[part]) curr[part] = {};
                curr = curr[part];
              }
            }
          }
          return root;
        };

        const renderNestedTree = (node, prefix = '') => {
          const keys = Object.keys(node);
          keys.sort((a, b) => {
            const aFolder = node[a] !== null;
            const bFolder = node[b] !== null;
            if (aFolder && !bFolder) return -1;
            if (!aFolder && bFolder) return 1;
            return a.localeCompare(b);
          });

          let out = '';
          for (const key of keys) {
            const isFolder = node[key] !== null;
            const currentPath = prefix ? `${prefix}/${key}` : key;
            if (isFolder) {
              const folderIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
              const children = renderNestedTree(node[key], currentPath);
              const depth = prefix.split('/').filter(Boolean).length;
              const openAttr = depth <= 1 ? ' open' : '';
              out += `<details class="folder-container"${openAttr}><summary class="folder-summary">${folderIcon}<span>${escapeHtml(key)}</span></summary><div class="folder-children">${children}</div></details>`;
            } else {
              const icon = getFileIcon(key);
              const activeClass = currentPath === filepath ? ' active' : '';
              const s = escapeHtml(currentPath);
              const name = escapeHtml(key);
              out += `
                <div class="file-row" data-path="${s}">
                  <a class="file-item${activeClass}" href="/p/${USER}/${proj}/${s}" data-path="${s}">${icon}<span>${name}</span></a>
                  <button class="btn-icon btn-update-file" data-path="${s}" title="Update this file">↻</button>
                </div>
              `;
            }
          }
          return out;
        };

        const nestedRoot = buildNestedTree(paths);
        const treeHtml = paths.length > 0 ? renderNestedTree(nestedRoot) : '<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">No files found.</div>';

        const { results: commits } = await env.DB.prepare(
          'SELECT hash12, author, message FROM commits WHERE user = ? AND proj = ? ORDER BY created_at DESC LIMIT 50'
        ).bind(USER, proj).all();

        const historyHtml = commits.length > 0
          ? commits.map(c => `<div class="commit-card"><b>${escapeHtml(c.hash12)}</b> ${escapeHtml(c.message)}<small>${escapeHtml(c.author)}</small></div>`).join('')
          : '<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">No commit history.</div>';

        let fileContentHtml = '';
        let breadcrumbsHtml = 'Select a file to preview';
        let copyStyleHtml = 'style="display: none;"';
        let defaultEmptyStyleHtml = '';
        let previewStyleHtml = 'style="display: none;"';
        let markdownStyleHtml = 'style="display: none;"';
        let markdownContentHtml = '';
        let imageStyleHtml = 'style="display: none;"';
        let imageContentHtml = '';

        if (filepath) {
          const object = await env.FILES.get(`projects/${USER}/${proj}/${filepath}`);
          if (object) {
            breadcrumbsHtml = `projects / ${escapeHtml(USER)} / ${escapeHtml(proj)} / <span>${escapeHtml(filepath)}</span>`;
            copyStyleHtml = 'style="display: block;"';
            defaultEmptyStyleHtml = 'style="display: none;"';

            const ext = filepath.split('.').pop().toLowerCase();
            if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) {
              const imageSrc = `/r/${USER}/${proj}/${filepath}`;
              imageContentHtml = `<img src="${imageSrc}" alt="${escapeHtml(filepath)}" style="max-width:100%; max-height:500px; border-radius:8px; box-shadow: var(--shadow-glass); background: var(--bg-glass-inset); padding:10px;">`;
              imageStyleHtml = 'style="display: flex;"';
            } else {
              const text = await object.text();
              fileContentHtml = escapeHtml(text);
              previewStyleHtml = 'style="display: block;"';
            }
          }
        }

        htmlContent = htmlContent.replace('<!-- SSR_TREE -->', treeHtml);
        htmlContent = htmlContent.replace('<!-- SSR_HISTORY -->', historyHtml);
        htmlContent = htmlContent.replace('<!-- SSR_BREADCRUMBS -->', breadcrumbsHtml);
        htmlContent = htmlContent.replace('<!-- SSR_COPY_STYLE -->', copyStyleHtml);
        htmlContent = htmlContent.replace('<!-- SSR_DEFAULT_EMPTY_STYLE -->', defaultEmptyStyleHtml);
        htmlContent = htmlContent.replace('<!-- SSR_PREVIEW_STYLE -->', previewStyleHtml);
        htmlContent = htmlContent.replace('<!-- SSR_FILE_CONTENT -->', fileContentHtml);
        htmlContent = htmlContent.replace('<!-- SSR_MARKDOWN_STYLE -->', markdownStyleHtml);
        htmlContent = htmlContent.replace('<!-- SSR_MARKDOWN_CONTENT -->', markdownContentHtml);
        htmlContent = htmlContent.replace('<!-- SSR_IMAGE_STYLE -->', imageStyleHtml);
        htmlContent = htmlContent.replace('<!-- SSR_IMAGE_CONTENT -->', imageContentHtml);

        return new Response(htmlContent, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
          }
        });
      }

      // 10. GET /dump/:user/:proj/
      if (method === 'GET' && pathname.startsWith('/dump/')) {
        const rest = pathname.substring('/dump/'.length);
        const segs = rest.split('/').filter(Boolean);
        const user = segs[0];
        const proj = safeProj(segs[1]);

        if (user !== USER || !proj) {
          return new Response('Not Found', { status: 404, headers: corsHeaders });
        }

        return await handleDump(user, proj, request, env, corsHeaders);
      }

      // Default static file serving via ASSETS
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.ok) {
        const headers = new Headers(assetRes.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return new Response(assetRes.body, { status: assetRes.status, headers });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      console.error(err);
      return new Response(err.message, { status: 500, headers: corsHeaders });
    }
  }
};
