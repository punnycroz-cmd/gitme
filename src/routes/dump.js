import { isBlocked, safeRelPath, safeProj } from '../security.js';
import { listProjectFiles } from '../storage.js';
import { jsonResponse, guessContentType, escapeHtml, getFileIcon, wantsJson, writeCorsHeaders } from '../helpers.js';
import { LIMITS } from '../config.js';

export async function getRawFile(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  
  // request.params.wildcard contains everything after /r/:user/:proj/
  const user = request.params.user;
  const proj = safeProj(request.params.proj);
  // In itty-router, query and params are handled. If wildcard is used, it maps to request.params[0] or similar.
  // We can also extract filepath from pathname directly to be absolutely sure.
  const url = new URL(request.url);
  const pathname = url.pathname;
  const prefix = `/r/${user}/${proj}/`;
  if (!pathname.startsWith(prefix)) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
  const filepath = safeRelPath(pathname.substring(prefix.length));

  if (user !== USER || !proj || !filepath || isBlocked(filepath)) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const object = await env.FILES.get(`projects/${USER}/${proj}/${filepath}`);
  if (!object) return new Response('Not Found', { status: 404, headers: corsHeaders });

  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', guessContentType(filepath));
  // Caching Phase 3.1
  headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');

  return new Response(object.body, { headers });
}

export async function getBrowser(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  
  const user = request.params.user;
  const proj = safeProj(request.params.proj);
  
  const url = new URL(request.url);
  const prefix = `/p/${user}/${proj}/`;
  let filepath = '';
  if (url.pathname.startsWith(prefix)) {
    filepath = safeRelPath(url.pathname.substring(prefix.length)) || '';
  }

  if (user !== USER || !proj) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const templateRes = await env.ASSETS.fetch(new Request(new URL('/browser-template.html', request.url)));
  if (!templateRes.ok) return new Response('Template not found', { status: 500 });
  let htmlContent = await templateRes.text();

  const files = await listProjectFiles(env.FILES, USER, proj);
  const paths = files.map(f => f.path);

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
    "SELECT hash12, author, message FROM commits WHERE user = ? AND proj = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 50"
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

export async function getDump(request, env) {
  const corsHeaders = writeCorsHeaders(request);
  const USER = env.TINYHUB_USER || 'andie';
  
  const user = request.params.user;
  const proj = safeProj(request.params.proj);

  if (user !== USER || !proj) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const { searchParams } = url;

  const lastCommit = await env.DB.prepare(
    "SELECT id, hash12, parent_hash12, message, stats_json, created_at FROM commits WHERE user = ? AND proj = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 1"
  ).bind(user, proj).first();

  // ETag check Phase 3.2
  const mode = searchParams.get('mode') || '';
  const maxTokens = searchParams.get('max_tokens') || '0';
  const forceJson = wantsJson(request, searchParams);
  const etag = `"${lastCommit?.hash12 || 'none'}-${mode || 'full'}-${maxTokens}-${forceJson ? 'json' : 'html'}"`;
  
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ...corsHeaders, 'ETag': etag } });
  }

  let changed = [];
  const since = searchParams.get('since') || '';
  if (since && lastCommit) {
    const sinceCommit = await env.DB.prepare(
      "SELECT id, hash12, created_at FROM commits WHERE hash12 = ? AND user = ? AND proj = ? AND status = 'complete'"
    ).bind(since === 'last' ? lastCommit.parent_hash12 || '' : since, user, proj).first();
    
    if (sinceCommit) {
      const commitsResult = await env.DB.prepare(
        "SELECT id, hash12 FROM commits WHERE user = ? AND proj = ? AND status = 'complete' AND created_at >= ?"
      ).bind(user, proj, sinceCommit.created_at).all();
      
      const commitIds = (commitsResult.results || []).map(c => c.id);
      if (commitIds.length > 0) {
        const queryPlaceholder = commitIds.map(() => '?').join(',');
        const filesResult = await env.DB.prepare(
          `SELECT DISTINCT path, change_type FROM commit_files WHERE commit_id IN (${queryPlaceholder})`
        ).bind(...commitIds).all();
        
        changed = filesResult.results || [];
      }
    }
  }

  const files = await listProjectFiles(env.FILES, user, proj);
  const paths = files.map(f => f.path);
  const sizeMap = new Map();
  for (const f of files) {
    sizeMap.set(f.path, f.size);
  }

  const isDeltaMode = mode === 'delta';
  const ALWAYS_INCLUDE = new Set(['PROJECT_STRUCTURE.md', 'README.md', 'package.json']);

  let filesToShow = paths;
  const skipped = [];

  if (isDeltaMode) {
    const modifiedOrAdded = new Set(changed.filter(c => c.change_type !== 'deleted').map(c => c.path));
    filesToShow = paths.filter(path => modifiedOrAdded.has(path) || ALWAYS_INCLUDE.has(path));
    const deletedList = changed.filter(c => c.change_type === 'deleted').map(c => c.path);
    for (const d of deletedList) {
      skipped.push({ path: d, reason: 'deleted_in_delta' });
    }
  }

  const filterPath = searchParams.get('path') ? safeRelPath(searchParams.get('path')) : null;
  if (filterPath) {
    const cleanFilter = filterPath.replace(/\/$/, '');
    const p = cleanFilter + '/';
    filesToShow = filesToShow.filter(path => {
      const isMatch = path.startsWith(p) || path === cleanFilter || ALWAYS_INCLUDE.has(path);
      if (!isMatch) skipped.push({ path, reason: 'path_filter_mismatch' });
      return isMatch;
    });
  }

  // Token budget
  const maxTokensVal = parseInt(maxTokens);
  if (maxTokensVal > 0) {
    const budgetBytes = maxTokensVal * 4;
    const sorted = [...filesToShow].sort((a, b) => {
      const aP = ALWAYS_INCLUDE.has(a) ? 0 : 1;
      const bP = ALWAYS_INCLUDE.has(b) ? 0 : 1;
      if (aP !== bP) return aP - bP;
      return (sizeMap.get(a) || 0) - (sizeMap.get(b) || 0);
    });
    let usedBytes = 0;
    const included = [];
    for (const path of sorted) {
      const size = sizeMap.get(path) || 0;
      if (usedBytes + size > budgetBytes && !ALWAYS_INCLUDE.has(path)) {
        skipped.push({ path, reason: 'token_budget', size });
      } else {
        included.push(path);
        usedBytes += size;
      }
    }
    filesToShow = included;
  }

  if (forceJson) {
    if (mode === 'summary') {
      const summaryFiles = files.map(f => ({ path: f.path, size: f.size, sha256: f.sha256 }));
      return jsonResponse({
        repo: `${user}/${proj}`,
        type: 'summary',
        commit: lastCommit?.hash12 || null,
        createdAt: lastCommit?.created_at || null,
        fileCount: summaryFiles.length,
        totalBytes: summaryFiles.reduce((s, f) => s + f.size, 0),
        files: summaryFiles,
        skipped
      }, 200, corsHeaders, { 'ETag': etag });
    }

    const payload = {};
    let totalBytes = 0;
    const R2_CONCURRENCY = 8;
    for (let i = 0; i < filesToShow.length; i += R2_CONCURRENCY) {
      const batch = filesToShow.slice(i, i + R2_CONCURRENCY);
      await Promise.all(
        batch.map(async (path) => {
          try {
            const size = sizeMap.get(path) || 0;
            if (size > LIMITS.DUMP_MAX_FILE_SIZE && !ALWAYS_INCLUDE.has(path)) {
              skipped.push({ path, reason: 'file_too_large', size });
              return;
            }
            const object = await env.FILES.get(`projects/${user}/${proj}/${path}`);
            if (!object) return;
            const text = await object.text();
            payload[path] = text;
            totalBytes += size;
          } catch (e) {
            console.error('get file fail', path, e);
          }
        })
      );
    }

    const deltaStats = isDeltaMode ? {
      added: changed.filter(c => c.change_type === 'added').length,
      modified: changed.filter(c => c.change_type === 'modified').length,
      deleted: changed.filter(c => c.change_type === 'deleted').length,
      unchanged: paths.length - changed.length
    } : null;

    return jsonResponse({
      repo: `${user}/${proj}`,
      type: isDeltaMode ? 'delta' : 'dump',
      commit: lastCommit?.hash12 || null,
      parent: lastCommit?.parent_hash12 || null,
      createdAt: lastCommit?.created_at || null,
      stats: isDeltaMode ? deltaStats : { added: filesToShow.length, modified: 0, deleted: 0, unchanged: 0 },
      fileCount: Object.keys(payload).length,
      totalBytes,
      files: payload,
      skipped
    }, 200, corsHeaders, { 'ETag': etag });
  }

  // HTML prompt rendering
  if (mode === 'summary') {
    const summaryFiles = files.map(f => ({ path: f.path, size: f.size, sha256: f.sha256 }));
    const templateRes = await env.ASSETS.fetch(new Request(new URL('/dump-template.html', request.url)));
    if (!templateRes.ok) return new Response('Template not found', { status: 500 });
    let tmpl = await templateRes.text();
    tmpl = tmpl.replace('<!-- SSR_PROJECT_NAME -->', escapeHtml(proj));
    tmpl = tmpl.replace('<!-- SSR_BROWSER_URL -->', `/p/${user}/${proj}/`);
    tmpl = tmpl.replace('<!-- SSR_RAW_DUMP_TEXT -->', escapeHtml(`// Summary: ${user}/${proj}\n// ${summaryFiles.length} files, ${summaryFiles.reduce((s, f) => s + f.size, 0)} bytes total\n`));
    tmpl = tmpl.replace('<!-- SSR_COMMIT_HASH -->', lastCommit?.hash12 || 'none');
    tmpl = tmpl.replace('<!-- SSR_COMMIT_CREATED_AT -->', lastCommit?.created_at ? new Date(lastCommit.created_at).toISOString() : '');
    
    return new Response(tmpl, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'ETag': etag
      }
    });
  }

  let textDump = '';
  const deltaStats = isDeltaMode ? {
    added: changed.filter(c => c.change_type === 'added').length,
    modified: changed.filter(c => c.change_type === 'modified').length,
    deleted: changed.filter(c => c.change_type === 'deleted').length,
    unchanged: paths.length - changed.length
  } : null;

  if (isDeltaMode) {
    textDump += `// TinyHub delta: ${user}/${proj}\n`;
    textDump += `// commit: ${lastCommit?.hash12 || 'none'} parent: ${lastCommit?.parent_hash12 || 'none'}\n`;
    textDump += `// pushed: ${lastCommit?.created_at ? new Date(lastCommit.created_at).toISOString() : 'unknown'}\n`;
    textDump += `// message: ${lastCommit?.message || 'none'}\n`;
    textDump += `// stats: +${deltaStats.added} ~${deltaStats.modified} -${deltaStats.deleted}\n\n`;
  } else {
    textDump += `// TinyHub repository dump: ${user}/${proj}\n`;
    textDump += `// commit: ${lastCommit?.hash12 || 'none'}\n`;
    textDump += `// pushed: ${lastCommit?.created_at ? new Date(lastCommit.created_at).toISOString() : 'unknown'}\n`;
    textDump += `// total files: ${filesToShow.length}\n\n`;
  }

  let totalBytes = 0;
  let fileCount = 0;
  const R2_CONCURRENCY = 8;
  for (let i = 0; i < filesToShow.length; i += R2_CONCURRENCY) {
    if (totalBytes >= LIMITS.DUMP_MAX_TOTAL) break;
    const batch = filesToShow.slice(i, i + R2_CONCURRENCY);
    await Promise.all(
      batch.map(async (path) => {
        try {
          const size = sizeMap.get(path) || 0;
          if (fileCount >= LIMITS.DUMP_MAX_FILES && !ALWAYS_INCLUDE.has(path)) {
            skipped.push({ path, reason: 'max_files' });
            return;
          }
          if (size > LIMITS.DUMP_MAX_FILE_SIZE && !ALWAYS_INCLUDE.has(path)) {
            skipped.push({ path, reason: 'file_too_large', size });
            return;
          }
          if (totalBytes + size > LIMITS.DUMP_MAX_TOTAL && !ALWAYS_INCLUDE.has(path)) {
            skipped.push({ path, reason: 'total_size_limit', size });
            return;
          }

          const object = await env.FILES.get(`projects/${user}/${proj}/${path}`);
          if (!object) return;
          const text = await object.text();
          textDump += `// File: ${path}\n${text}\n\n`;
          totalBytes += size;
          fileCount++;
        } catch (e) {
          console.error('get file fail', path, e);
        }
      })
    );
  }

  if (skipped.length > 0) {
    textDump += `// Skipped files:\n`;
    for (const item of skipped) {
      textDump += `// - ${item.path}: ${item.reason}${item.size ? ` (${item.size} bytes)` : ''}\n`;
    }
    textDump += `\n`;
  }

  const templateRes = await env.ASSETS.fetch(new Request(new URL('/dump-template.html', request.url)));
  if (!templateRes.ok) return new Response('Template not found', { status: 500 });
  let tmpl = await templateRes.text();

  tmpl = tmpl.replace('<!-- SSR_PROJECT_NAME -->', escapeHtml(proj));
  tmpl = tmpl.replace('<!-- SSR_BROWSER_URL -->', `/p/${user}/${proj}/`);
  tmpl = tmpl.replace('<!-- SSR_RAW_DUMP_TEXT -->', escapeHtml(textDump));
  tmpl = tmpl.replace('<!-- SSR_COMMIT_HASH -->', lastCommit?.hash12 || 'none');
  tmpl = tmpl.replace('<!-- SSR_COMMIT_CREATED_AT -->', lastCommit?.created_at ? new Date(lastCommit.created_at).toISOString() : '');

  const responseHeaders = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'ETag': etag,
    'X-TinyHub-Commit': lastCommit?.hash12 || 'none',
    'X-TinyHub-Parent': lastCommit?.parent_hash12 || 'none',
    'X-TinyHub-Created-At': lastCommit?.created_at ? new Date(lastCommit.created_at).toISOString() : 'unknown'
  };

  return new Response(tmpl, { headers: responseHeaders });
}
