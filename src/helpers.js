import { isBlocked, safeRelPath, safeProj } from './security.js';

export const MIME_MAP = {
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

export function guessContentType(filePath) {
  const base = filePath.split('/').pop() || filePath;
  if (base === '.firebaserc' || base === '.npmrc') return 'application/json; charset=utf-8';
  if (base === '.gitignore' || base === '.gitattributes' || base === '.editorconfig' || base === '_redirects') {
    return 'text/plain; charset=utf-8';
  }
  const ext = (base.includes('.') ? base.split('.').pop() : '').toLowerCase();
  return MIME_MAP[ext] || 'text/plain; charset=utf-8';
}

export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const colors = {
    js: '#f1e05a', ts: '#3178c6', html: '#e34c26', css: '#563d7c',
    md: '#4f46e5', json: '#e88800', py: '#3572A5', png: '#10b981',
    jpg: '#10b981', jpeg: '#10b981', gif: '#10b981', svg: '#06b6d4'
  };
  const color = colors[ext] || '#9ca3af';
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
}

export function wantsJson(request, searchParams) {
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

export function jsonResponse(body, status, corsHeaders, extraHeaders = {}) {
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

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function checkAuth(request, env) {
  const token = env.TINYHUB_TOKEN;
  if (!token) return false;
  const authHeader = request.headers.get('Authorization') || '';
  const expectedAuth = `Bearer ${token}`;
  return timingSafeEqual(authHeader, expectedAuth);
}

export function writeCorsHeaders(request) {
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

export function buildStructuredTree(paths, sizes = {}) {
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
