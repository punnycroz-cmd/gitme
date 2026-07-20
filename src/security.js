// src/security.js
export const BLOCKED_DIRS = new Set([
  '.git', 'node_modules', '__pycache__', 'dist', 'build', '.next', '.venv',
  'data', '.firebase', '.qwen', '.wrangler', 'coverage', '.turbo'
]);

export const BLOCKED_BASENAMES = new Set([
  '.DS_Store', 'Thumbs.db', 'id_rsa', 'id_ed25519', 'credentials.json', 'service-account.json',
  '.dev.vars', '.env'
]);

export const BLOCKED_EXTS = ['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore'];

export function isBlocked(relPath) {
  if (!relPath) return true;
  const clean = relPath.replace(/\\/g, '/');
  const parts = clean.split('/').filter(Boolean);
  if (parts.some(p => BLOCKED_DIRS.has(p))) return true;
  if (parts.some(p => BLOCKED_BASENAMES.has(p))) return true;
  if (parts.some(p => BLOCKED_EXTS.some(ext => p.endsWith(ext)))) return true;
  if (parts.some(p => p === '.env' || (p.startsWith('.env.') && p !== '.env.example'))) return true;
  return false;
}

export function safeRelPath(p) {
  if (!p) return null;
  const clean = p.replace(/\\/g, '/');
  if (clean.split('/').includes('..') || clean.startsWith('/')) return null;
  
  const segs = [];
  for (const s of clean.split('/')) {
    if (s === '..') return null;
    if (s !== '.' && s !== '') segs.push(s);
  }
  const out = segs.join('/');
  if (!out) return null;
  if (isBlocked(out)) return null;
  return out;
}

export function safeProj(proj) {
  if (!proj) return null;
  if (proj.includes('/') || proj.includes('\\') || proj.includes('..')) return null;
  const trimmed = proj.trim();
  if (!trimmed || trimmed === '.') return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizeUploadPath(raw, proj) {
  const safe = safeRelPath(raw);
  if (!safe) return null;
  const parts = safe.split('/');
  if (parts.length > 1 && parts[0].toLowerCase() === proj.toLowerCase()) {
    return safeRelPath(parts.slice(1).join('/'));
  }
  return safe;
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Bytes(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
