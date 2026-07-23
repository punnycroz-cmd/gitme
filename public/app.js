// Theme toggle — Watercolor Glass (light ↔ twilight)
(function () {
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  function updateIcon(theme) {
    var sun = toggle.querySelector('.icon-sun');
    var moon = toggle.querySelector('.icon-moon');
    if (sun && moon) {
      sun.style.display = theme === 'twilight' ? 'none' : '';
      moon.style.display = theme === 'twilight' ? '' : 'none';
    }
  }

  toggle.addEventListener('click', function () {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme') || 'light';
    var next = current === 'light' ? 'twilight' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('tinyhub-theme', next);
    updateIcon(next);
  });

  var saved = localStorage.getItem('tinyhub-theme');
  if (saved) {
    updateIcon(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    updateIcon('twilight');
  }
})();

let API_BASE = window.TINYHUB_API_BASE || localStorage.getItem('TINYHUB_API_BASE') || '';

// Parse URL api query parameter if present
const urlParams = new URLSearchParams(window.location.search);
const queryApi = urlParams.get('api');
if (queryApi) {
  API_BASE = queryApi.replace(/\/$/, '');
  localStorage.setItem('TINYHUB_API_BASE', API_BASE);
}

// One-time migration: move token from localStorage to sessionStorage
(function () {
  var oldToken = localStorage.getItem('TINYHUB_TOKEN');
  if (oldToken && !sessionStorage.getItem('TINYHUB_TOKEN')) {
    sessionStorage.setItem('TINYHUB_TOKEN', oldToken);
    localStorage.removeItem('TINYHUB_TOKEN');
  }
})();

async function initConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data && data.apiBase && !API_BASE) {
      API_BASE = data.apiBase.replace(/\/$/, '');
      localStorage.setItem('TINYHUB_API_BASE', API_BASE);
    }
    if (data && data.user) {
      window.TINYHUB_USER = data.user;
      const userDisplay = document.getElementById('user-display');
      if (userDisplay) userDisplay.textContent = data.user;
    }
  } catch (e) {
    console.warn('Could not fetch API configuration base:', e);
    if (!API_BASE && window.location.hostname.endsWith('pages.dev')) {
      const inputUrl = prompt(
        'Welcome! Please enter your Cloudflare Worker URL to connect the backend:\n(e.g., https://tinyhub-api.yoursubdomain.workers.dev)'
      );
      if (inputUrl) {
        API_BASE = inputUrl.replace(/\/$/, '');
        localStorage.setItem('TINYHUB_API_BASE', API_BASE);
        window.location.reload();
      }
    }
  }
}

const drop = document.getElementById('drop');
const folder = document.getElementById('folder');
const status = document.getElementById('status');
const projInput = document.getElementById('proj');

if (projInput) {
  projInput.addEventListener('input', () => {
    projInput.dataset.userEdited = 'true';
  });
}

if (drop) {
  ['dragenter', 'dragover'].forEach((e) =>
    drop.addEventListener(e, (ev) => {
      ev.preventDefault();
      drop.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((e) =>
    drop.addEventListener(e, (ev) => {
      ev.preventDefault();
      drop.classList.remove('dragover');
    })
  );

  drop.addEventListener('drop', (ev) => {
    handleIncomingFiles(ev.dataTransfer.files);
  });
}

if (folder) {
  folder.addEventListener('change', (ev) => {
    handleIncomingFiles(ev.target.files);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isBlocked(path) {
  if (!path) return true;
  const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = cleanPath.split('/').filter(Boolean);

  const blockedDirs = new Set([
    '.git',
    'node_modules',
    '__pycache__',
    'dist',
    'build',
    '.next',
    '.venv',
    'data',
    '.firebase',
    '.qwen',
    '.wrangler',
    'coverage',
    '.turbo',
  ]);
  if (parts.some((p) => blockedDirs.has(p))) {
    return true;
  }

  for (const p of parts) {
    if (p.endsWith('.pem') || p.endsWith('.key') || p.endsWith('.p12') || p.endsWith('.pfx') || p.endsWith('.jks') || p.endsWith('.keystore')) {
      return true;
    }
    if (p === '.DS_Store' || p === 'Thumbs.db' || p === 'id_rsa' || p === 'id_ed25519' || p === 'credentials.json' || p === 'service-account.json' || p === '.dev.vars') {
      return true;
    }
    if (p === '.env' || (p.startsWith('.env.') && p !== '.env.example')) {
      return true;
    }
  }
  return false;
}

function detectProjectName(fileList) {
  const first = fileList[0]?.webkitRelativePath || fileList[0]?.name || '';
  const detected = first.includes('/') ? first.split('/')[0] : '';
  if (detected && (!projInput || !projInput.dataset.userEdited)) {
    const cleanName = detected.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    if (projInput) projInput.value = cleanName;
    return cleanName;
  }
  return (projInput ? projInput.value : '') || 'my-app';
}

/** Relative path inside project (strip webkit folder root). */
function relativeProjectPath(file, proj) {
  let path = file.webkitRelativePath || file.name || '';
  path = path.replace(/\\/g, '/');
  if (file.webkitRelativePath && path.includes('/')) {
    path = path.split('/').slice(1).join('/');
  } else if (proj && path.toLowerCase().startsWith(proj.toLowerCase() + '/')) {
    path = path.slice(proj.length + 1);
  }
  return path;
} const HASH_CACHE_DB = 'tinyhub-hash-cache';
const HASH_CACHE_STORE = 'hashes';

function openHashCacheDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) return resolve(null);
    const req = window.indexedDB.open(HASH_CACHE_DB, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(HASH_CACHE_STORE)) {
        db.createObjectStore(HASH_CACHE_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => {
      console.warn('IndexedDB hash cache unavailable', e);
      resolve(null);
    };
  });
}

async function getCachedHash(db, key) {
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(HASH_CACHE_STORE, 'readonly');
      const store = tx.objectStore(HASH_CACHE_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function putCachedHash(db, key, data) {
  if (!db) return;
  try {
    const tx = db.transaction(HASH_CACHE_STORE, 'readwrite');
    const store = tx.objectStore(HASH_CACHE_STORE);
    store.put({ key, ...data });
  } catch (e) {
    console.warn('Failed to save hash to IndexedDB', e);
  }
}

const remoteTreeCache = new Map();

async function sha256HexFile(file) {
  const buf = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function defaultPushMessage(stats) {
  return `Push: +${stats.added} ~${stats.modified} -${stats.deleted}`;
}

/**
 * Classify local files vs remote tip meta.
 * remoteMeta: { path, size, sha256 }[] or path strings
 */
async function classifyLocalVsRemote(incoming, remoteFiles, mode, proj) {
  const remoteMap = {};
  for (const f of remoteFiles || []) {
    if (typeof f === 'string') {
      remoteMap[f] = { path: f, size: null, sha256: null };
    } else if (f && f.path) {
      remoteMap[f.path] = f;
    }
  }

  const added = [];
  const modified = [];
  const unchanged = [];
  const localPaths = new Set();
  const db = await openHashCacheDB();

  // Hash in parallel batches
  const CONCURRENCY = 8;
  for (let i = 0; i < incoming.length; i += CONCURRENCY) {
    const batch = incoming.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        localPaths.add(item.path);
        const remote = remoteMap[item.path];
        const cacheKey = proj ? `${proj}/${item.path}` : item.path;
        let sha = null;

        // FAST PATH: reuse cached hash if size and lastModified match
        const cached = await getCachedHash(db, cacheKey);
        if (
          cached &&
          cached.size === item.file.size &&
          cached.lastModified === item.file.lastModified &&
          cached.hash
        ) {
          sha = cached.hash;
        } else {
          try {
            sha = await sha256HexFile(item.file);
            if (sha) {
              await putCachedHash(db, cacheKey, {
                size: item.file.size,
                lastModified: item.file.lastModified,
                hash: sha
              });
            }
          } catch (e) {
            console.warn('hash failed', item.path, e);
          }
        }

        item.sha256 = sha;
        item.size = item.file.size;

        if (!remote) {
          added.push(item.path);
        } else if (sha && remote.sha256 && sha === remote.sha256) {
          unchanged.push(item.path);
        } else if (
          sha &&
          !remote.sha256 &&
          remote.size != null &&
          remote.size === item.file.size
        ) {
          // Same size but no remote hash — still treat as modified (server will no-op if equal)
          modified.push(item.path);
        } else {
          modified.push(item.path);
        }
      })
    );
  }

  const deleted = [];
  if (mode !== 'merge') {
    for (const path of Object.keys(remoteMap)) {
      if (!localPaths.has(path)) deleted.push(path);
    }
  }

  added.sort();
  modified.sort();
  deleted.sort();
  unchanged.sort();

  return {
    added,
    modified,
    deleted,
    unchanged,
    totalFiles: incoming.length,
    stats: {
      added: added.length,
      modified: modified.length,
      deleted: deleted.length,
      unchanged: unchanged.length,
      totalFiles: incoming.length
    }
  };
}

function renderChangeList(title, cls, paths, limit = 40) {
  if (!paths.length) return '';
  const shown = paths.slice(0, limit);
  const more = paths.length > limit ? `<div class="diff-more">…and ${paths.length - limit} more</div>` : '';
  return (
    `<div class="diff-section ${cls}">` +
    `<div class="diff-section-title">${escapeHtml(title)} (${paths.length})</div>` +
    shown.map((p) => `<div class="diff-line">${escapeHtml(p)}</div>`).join('') +
    more +
    `</div>`
  );
}

let existingProjects = [];
let pendingFiles = null;
let pendingProj = null;
let pendingBlocked = [];
let pendingClassification = null;

async function loadProjects() {
  await initConfig();
  try {
    const res = await fetch(`${API_BASE}/api/projects`, { cache: 'no-store' });
    existingProjects = await res.json();
    if (!Array.isArray(existingProjects)) existingProjects = [];
    renderProjects(existingProjects);
  } catch (e) {
    console.warn('Could not load projects list:', e);
  }
}

function renderProjects(projects) {
  const panel = document.getElementById('projects-panel');
  const list = document.getElementById('projects-list');
  if (!list || !panel) return;
  if (!projects || projects.length === 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  list.innerHTML = projects
    .map((p) => {
      const name = escapeHtml(p.name);
      const date = new Date(p.updatedAt * 1000).toLocaleString();
      const commitsCount =
        p.commitsCount !== undefined ? ` · ${p.commitsCount} commits` : '';
      const filesCount = p.filesCount !== undefined ? ` · ${p.filesCount} files` : '';
      const u = encodeURIComponent(window.TINYHUB_USER || 'andie');
      return `
      <div class="project-row">
        <div class="project-info">
          <div class="project-name">${name}</div>
          <div class="project-meta">Updated ${date}${filesCount}${commitsCount}</div>
        </div>
        <div class="project-actions" style="display: flex; align-items: center; gap: 12px;">
          <a href="/p/${u}/${name}/">Browse</a>
          <a href="/dump/${u}/${name}/">AI Dump</a>
          <button class="btn-delete-proj" data-proj="${name}" style="background: transparent; border: none; color: var(--error, #e11d48); cursor: pointer; font-size: 13px; font-weight: 500; padding: 4px 8px; border-radius: var(--radius-sm);">Delete</button>
        </div>
      </div>
    `;
    })
    .join('');
}

async function handleIncomingFiles(fileList) {
  await initConfig();
  const proj = detectProjectName(fileList);

  const incomingPaths = [];
  const blockedLocal = [];
  for (const f of fileList) {
    const full = f.webkitRelativePath || f.name;
    if (isBlocked(full)) {
      blockedLocal.push(full);
      continue;
    }
    const path = relativeProjectPath(f, proj);
    if (!path || isBlocked(path)) {
      blockedLocal.push(full);
      continue;
    }
    incomingPaths.push({ file: f, path });
  }

  if (incomingPaths.length === 0) {
    status.innerHTML = `No files to push. Blocked ${blockedLocal.length} files locally.<br>Blocked: ${escapeHtml(
      blockedLocal.slice(0, 10).join(', ')
    )}${blockedLocal.length > 10 ? '...' : ''}`;
    return;
  }

  status.textContent = 'Comparing with remote (hashing files)…';

  let remoteFiles = [];
  let remoteExists = false;
  const cachedTree = remoteTreeCache.get(proj);
  const headers = {};
  if (cachedTree && cachedTree.etag) {
    headers['If-None-Match'] = cachedTree.etag;
  }

  try {
    const treeRes = await fetch(`${API_BASE}/api/tree/${encodeURIComponent(proj)}?meta=1`, {
      headers,
      cache: 'no-store',
    });
    if (treeRes.status === 304 && cachedTree) {
      remoteFiles = cachedTree.files;
      remoteExists = remoteFiles.length > 0;
    } else if (treeRes.ok) {
      const etag = treeRes.headers.get('ETag');
      const data = await treeRes.json();
      var remoteTip = null;
      if (Array.isArray(data)) {
        remoteFiles = data.map((p) => ({ path: p, size: null, sha256: null }));
      } else if (data && Array.isArray(data.files)) {
        remoteFiles = data.files;
        remoteTip = data.commit || null;
      }
      remoteExists = remoteFiles.length > 0;
      if (etag) {
        remoteTreeCache.set(proj, { etag, files: remoteFiles, tip: remoteTip });
      }
    }
  } catch (e) {
    console.warn('tree meta failed', e);
  }

  // Also treat known project index as exists even if empty
  if (!remoteExists) {
    remoteExists = !!existingProjects.find((p) => p.name.toLowerCase() === proj.toLowerCase());
  }

  const modeSelect = document.getElementById('push-mode');
  const mode = (modeSelect && modeSelect.value) || 'push';

  const classification = await classifyLocalVsRemote(incomingPaths, remoteFiles, mode, proj);

  // First push to empty remote: still show confirm with all as added
  pendingFiles = fileList;
  pendingProj = proj;
  pendingBlocked = blockedLocal;
  pendingClassification = classification;

  showPushModal(proj, classification, remoteExists, blockedLocal.length);
}

function showPushModal(proj, classification, remoteExists, blockedCount) {
  const modal = document.getElementById('confirm-modal');
  const title = document.getElementById('modal-title');
  const desc = document.getElementById('modal-desc');
  const diffContainer = document.getElementById('modal-diff');
  const msgInput = document.getElementById('push-message');
  const okBtn = document.getElementById('confirm-ok');

  if (title) title.textContent = remoteExists ? `Push to ${proj}` : `Create ${proj}`;

  const { stats, added, modified, deleted, unchanged } = classification;
  const empty =
    stats.added === 0 && stats.modified === 0 && stats.deleted === 0;

  if (desc) {
    desc.innerHTML =
      `Working tree vs remote <strong>${escapeHtml(proj)}</strong> (like <code>git push</code>).<br>` +
      `Local files: ${stats.totalFiles}` +
      (blockedCount ? ` · blocked locally: ${blockedCount}` : '') +
      (empty
        ? `<br><strong>Everything up-to-date</strong> — no commit will be created.`
        : `<br>Changes: <span class="diff-added">+${stats.added}</span> ` +
        `<span class="diff-changed">~${stats.modified}</span> ` +
        `<span class="diff-removed">-${stats.deleted}</span>` +
        (unchanged.length ? ` · ${unchanged.length} unchanged` : ''));
  }

  let diffHtml = '';
  diffHtml += renderChangeList('Added', 'diff-added', added);
  diffHtml += renderChangeList('Modified', 'diff-changed', modified);
  diffHtml += renderChangeList('Deleted on remote', 'diff-removed', deleted);
  if (unchanged.length) {
    diffHtml += `<div class="diff-section diff-unchanged"><div class="diff-section-title">Unchanged (${unchanged.length}) — collapsed</div></div>`;
  }
  if (!diffHtml) diffHtml = '<div class="diff-empty">No differences.</div>';
  if (diffContainer) diffContainer.innerHTML = diffHtml;

  if (msgInput) {
    msgInput.value = empty ? '' : defaultPushMessage(stats);
    msgInput.disabled = empty;
  }

  const tokenInput = document.getElementById('push-token');
  if (tokenInput) {
    tokenInput.value = sessionStorage.getItem('TINYHUB_TOKEN') || localStorage.getItem('TINYHUB_TOKEN') || '';
  }

  if (okBtn) {
    okBtn.textContent = empty ? 'Close' : 'Push';
    okBtn.classList.toggle('btn-danger', !empty && deleted.length > 0);
    okBtn.dataset.empty = empty ? '1' : '0';
  }

  if (modal) modal.style.display = 'flex';
  status.textContent = empty ? 'Everything up-to-date.' : 'Review changes, then Push.';
}

const TEXT_EXT_RE = /\.(js|ts|jsx|tsx|css|html|json|md|txt|xml|svg|yaml|yml|toml|py|rb|go|rs|java|c|cpp|h|sh|sql)$/i;

async function compressForUpload(file) {
  if (!TEXT_EXT_RE.test(file.name) || file.size < 512) {
    return { body: file, encoding: 'identity' };
  }
  try {
    const compressedStream = file.stream().pipeThrough(new CompressionStream('gzip'));
    const compressed = await new Response(compressedStream).blob();
    if (compressed.size < file.size * 0.8) {
      return { body: compressed, encoding: 'gzip' };
    }
  } catch (e) { /* fallback to identity */ }
  return { body: file, encoding: 'identity' };
}

function performPush(fileList, proj, blockedLocal, message, mode) {
  const fd = new FormData();
  let filesToUploadCount = 0;
  const encodings = {};

  const classification = pendingClassification || { added: [], modified: [], deleted: [], unchanged: [] };
  const toUpload = new Set([...classification.added, ...classification.modified]);
  const deleted = classification.deleted || [];
  const isIncremental = (toUpload.size > 0 || deleted.length > 0);

  const uploadTasks = [];
  for (const f of fileList) {
    const full = f.webkitRelativePath || f.name;
    if (isBlocked(full)) continue;
    const path = relativeProjectPath(f, proj);
    if (!path || isBlocked(path)) continue;

    if (isIncremental && !toUpload.has(path)) continue;

    uploadTasks.push({ file: f, path });
  }

  Promise.all(uploadTasks.map(async ({ file, path }) => {
    const { body, encoding } = await compressForUpload(file);
    fd.append('files', body, path);
    if (encoding === 'gzip') encodings[path] = 'gzip';
    filesToUploadCount++;
  })).then(() => {
    fd.append('message', message || '');
    fd.append('mode', mode || 'push');
    fd.append('encodings', JSON.stringify(encodings));

    const cachedTree = remoteTreeCache.get(proj);
    if (cachedTree && cachedTree.tip) {
      fd.append('baseTip', cachedTree.tip);
    }

    if (isIncremental) {
      fd.append('incremental', '1');
      fd.append('deletes', JSON.stringify(deleted));
      status.textContent = `Pushing ${filesToUploadCount} changed files to ${proj}… (${classification.unchanged?.length || 0} unchanged skipped)`;
    } else {
      status.textContent = `Pushing ${filesToUploadCount} files to ${proj}…`;
    }

    const uploadHeaders = {};
    const token = sessionStorage.getItem('TINYHUB_TOKEN') || localStorage.getItem('TINYHUB_TOKEN') || '';
    if (token) {
      uploadHeaders['Authorization'] = `Bearer ${token}`;
    }

    fetch(`${API_BASE}/api/upload/${encodeURIComponent(proj)}`, {
      method: 'POST',
      headers: uploadHeaders,
      body: fd
    })
      .then((r) => {
        if (r.status === 409) {
          return r.json().then((conflict) => {
            status.innerHTML = `<strong>⚠️ Conflict detected</strong> — remote has newer commits.<br>` +
              `Your tip: <code>${escapeHtml(conflict.yourTip || '')}</code> · Remote tip: <code>${escapeHtml(conflict.remoteTip || '')}</code><br>` +
              `<a href="#" onclick="window.location.reload(); return false;">Refresh and retry →</a>`;
            throw new Error('conflict');
          });
        }
        if (!r.ok) {
          return r
            .json()
            .catch(() => ({ error: `Push failed with status ${r.status}` }))
            .then((errData) => {
              throw new Error(errData.error || errData.message || `Push failed with status ${r.status}`);
            });
        }
        return r.json();
      })
      .then(async (data) => {
        const combinedBlocked = [...blockedLocal, ...(data.blocked || [])];
        const c = data.commit || {};
        const st = data.stats || {};
        const commitHash = c.hash || '';
        const vParam = commitHash ? `?v=${commitHash}` : `?v=${Date.now()}`;

        const curUser = encodeURIComponent(window.TINYHUB_USER || 'andie');
        if (data.empty) {
          status.innerHTML =
            `<strong>Everything up-to-date</strong> — nothing to push to <code>${escapeHtml(proj)}</code>.` +
            (combinedBlocked.length
              ? `<br>Blocked: ${escapeHtml(combinedBlocked.slice(0, 8).join(', '))}`
              : '') +
            `<br><a href="/p/${curUser}/${escapeHtml(proj)}/${vParam}">Browse →</a> · <a href="/dump/${curUser}/${escapeHtml(proj)}/${vParam}"><strong>AI dump →</strong></a>` +
            `<div style="margin-top:12px; display:flex; gap:8px;">` +
            `  <a class="btn" href="/dump/${curUser}/${escapeHtml(proj)}/${vParam}">Copy Full</a>` +
            `  <a class="btn btn-secondary" href="/dump/${curUser}/${escapeHtml(proj)}/?mode=delta&since=last">Copy Delta</a>` +
            `  <a class="btn btn-secondary" href="/dump/${curUser}/${escapeHtml(proj)}/?path=public&mode=delta&since=last">Copy public/ only</a>` +
            `</div>`;
        } else {
          status.innerHTML =
            `<strong>Pushed</strong> <code>${escapeHtml(c.hash || '')}</code> — ${escapeHtml(c.message || data.message || '')}<br>` +
            `<span class="diff-added">+${st.added ?? 0}</span> ` +
            `<span class="diff-changed">~${st.modified ?? 0}</span> ` +
            `<span class="diff-removed">-${st.deleted ?? 0}</span>` +
            (combinedBlocked.length
              ? `<br>Blocked ${combinedBlocked.length}: ${escapeHtml(combinedBlocked.slice(0, 8).join(', '))}`
              : '') +
            `<br><a href="/p/${curUser}/${escapeHtml(proj)}/${vParam}">Browse →</a> · <a href="/dump/${curUser}/${escapeHtml(proj)}/${vParam}"><strong>AI dump →</strong></a>` +
            `<div style="margin-top:12px; display:flex; gap:8px;">` +
            `  <a class="btn" href="/dump/${curUser}/${escapeHtml(proj)}/${vParam}">Copy Full</a>` +
            `  <a class="btn btn-secondary" href="/dump/${curUser}/${escapeHtml(proj)}/?mode=delta&since=last">Copy Delta</a>` +
            `  <a class="btn btn-secondary" href="/dump/${curUser}/${escapeHtml(proj)}/?path=public&mode=delta&since=last">Copy public/ only</a>` +
            `</div>`;
        }

        try {
          const tipRes = await fetch(`${API_BASE}/api/tip/${encodeURIComponent(proj)}`);
          if (tipRes.ok) {
            const tip = await tipRes.json();
            if (commitHash && tip.commit !== commitHash) {
              status.innerHTML += `<br><span style="color:var(--error, #e11d48); font-weight: 500;">⚠️ Database tip lag: expected ${commitHash}, got ${tip.commit} in database. Reload to sync.</span>`;
            }
          }
        } catch (e) {
          console.error('Failed to verify D1 tip freshness:', e);
        }

        if (folder) folder.value = '';
        if (projInput) delete projInput.dataset.userEdited;
        remoteTreeCache.delete(proj);
        setTimeout(loadProjects, 800);
      })
      .catch((err) => {
        if (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized')) {
          const inputToken = prompt('Authentication required (401 Unauthorized).\nPlease enter your TINYHUB_TOKEN:');
          if (inputToken && inputToken.trim()) {
            sessionStorage.setItem('TINYHUB_TOKEN', inputToken.trim());
            status.textContent = 'Token saved. Retrying push…';
            performPush(fileList, proj, blockedLocal, message, mode);
            return;
          }
        }
        status.textContent = `Push failed: ${err.message}`;
        setTimeout(loadProjects, 500);
      });
  });
}

const cancelBtn = document.getElementById('confirm-cancel');
if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.style.display = 'none';
    pendingFiles = null;
    pendingProj = null;
    pendingBlocked = [];
    pendingClassification = null;
    status.textContent = 'Push cancelled.';
  });
}

const okBtn = document.getElementById('confirm-ok');
if (okBtn) {
  okBtn.addEventListener('click', () => {
    const modal = document.getElementById('confirm-modal');
    const empty = okBtn.dataset.empty === '1';
    if (modal) modal.style.display = 'none';

    if (empty || !pendingFiles || !pendingProj) {
      pendingFiles = null;
      pendingProj = null;
      if (empty) status.textContent = 'Everything up-to-date.';
      return;
    }

    const msgInput = document.getElementById('push-message');
    const modeSelect = document.getElementById('push-mode');
    const tokenInput = document.getElementById('push-token');

    const message = msgInput ? msgInput.value.trim() : '';
    const mode = modeSelect ? modeSelect.value : 'push';

    if (tokenInput && tokenInput.value.trim()) {
      sessionStorage.setItem('TINYHUB_TOKEN', tokenInput.value.trim());
    }

    performPush(pendingFiles, pendingProj, pendingBlocked, message, mode);
    pendingFiles = null;
    pendingProj = null;
    pendingBlocked = [];
    pendingClassification = null;
  });
}

// Re-classify when mode changes while modal open
const modeSelectEl = document.getElementById('push-mode');
if (modeSelectEl) {
  modeSelectEl.addEventListener('change', async () => {
    if (!pendingFiles || !pendingProj) return;
    status.textContent = 'Recomputing with new mode…';
    // Rebuild incoming list
    const incomingPaths = [];
    for (const f of pendingFiles) {
      const full = f.webkitRelativePath || f.name;
      if (isBlocked(full)) continue;
      const path = relativeProjectPath(f, pendingProj);
      if (!path || isBlocked(path)) continue;
      incomingPaths.push({ file: f, path });
    }
    let remoteFiles = [];
    const cachedTree = remoteTreeCache.get(pendingProj);
    const treeHeaders = {};
    if (cachedTree?.etag) treeHeaders['If-None-Match'] = cachedTree.etag;
    try {
      const treeRes = await fetch(
        `${API_BASE}/api/tree/${encodeURIComponent(pendingProj)}?meta=1`,
        { headers: treeHeaders, cache: 'no-store' }
      );
      if (treeRes.status === 304 && cachedTree) {
        remoteFiles = cachedTree.files;
      } else if (treeRes.ok) {
        const data = await treeRes.json();
        remoteFiles = Array.isArray(data) ? data.map((p) => ({ path: p })) : data.files || [];
        const etag = treeRes.headers.get('ETag');
        if (etag) remoteTreeCache.set(pendingProj, { etag, files: remoteFiles, tip: data.commit || cachedTree?.tip });
      }
    } catch (_) { }
    pendingClassification = await classifyLocalVsRemote(
      incomingPaths,
      remoteFiles,
      modeSelectEl.value,
      pendingProj
    );
    showPushModal(
      pendingProj,
      pendingClassification,
      true,
      pendingBlocked.length
    );
  });
}

// --- Delete Project Feature Logic ---
const deleteModal = document.getElementById('delete-modal');
const deleteProjName = document.getElementById('delete-proj-name');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const deleteTokenInput = document.getElementById('delete-token-input');
const deleteCancel = document.getElementById('delete-cancel');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
let projectToDelete = '';

function openDeleteModal(projName) {
  projectToDelete = projName;
  deleteProjName.textContent = projName;
  deleteConfirmInput.value = '';
  deleteConfirmInput.placeholder = projName;

  // Pre-fill token if stored in localStorage
  const storedToken = sessionStorage.getItem('TINYHUB_TOKEN') || localStorage.getItem('TINYHUB_TOKEN') || '';
  deleteTokenInput.value = storedToken;

  deleteConfirmBtn.disabled = true;
  deleteModal.style.display = 'flex';
}

if (deleteConfirmInput) {
  deleteConfirmInput.addEventListener('input', () => {
    deleteConfirmBtn.disabled = deleteConfirmInput.value.trim() !== projectToDelete;
  });
}

if (deleteCancel) {
  deleteCancel.addEventListener('click', () => {
    deleteModal.style.display = 'none';
  });
}

if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener('click', async () => {
    const token = deleteTokenInput.value.trim() || sessionStorage.getItem('TINYHUB_TOKEN') || localStorage.getItem('TINYHUB_TOKEN') || '';
    if (token) {
      sessionStorage.setItem('TINYHUB_TOKEN', token);
    }

    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Deleting…';

    try {
      const res = await fetch(`${API_BASE}/api/reset/${encodeURIComponent(projectToDelete)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(await res.text() || `HTTP ${res.status}`);
      }

      deleteModal.style.display = 'none';
      await loadProjects();
      alert(`Project ${projectToDelete} has been successfully deleted.`);
    } catch (err) {
      alert(`Deletion failed: ${err.message}`);
    } finally {
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = 'Delete permanently';
    }
  });
}

// Attach event delegation for delete button inside projects list
const projectsListEl = document.getElementById('projects-list');
if (projectsListEl) {
  projectsListEl.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-delete-proj')) {
      const proj = e.target.dataset.proj;
      if (proj) openDeleteModal(proj);
    }
  });
}

loadProjects();
