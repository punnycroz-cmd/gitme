// TinyHub — security: path validation, blocklist, hashing, auth.
// Ported & hardened from the original src/security.js + helpers.js.

export const BLOCKED_DIRS = new Set([
  ".git", "node_modules", "__pycache__", "dist", "build", ".next", ".venv",
  "data", ".firebase", ".qwen", ".wrangler", "coverage", ".turbo", ".sveltekit",
  ".nuxt", ".cache",
]);

export const BLOCKED_BASENAMES = new Set([
  ".DS_Store", "Thumbs.db", "id_rsa", "id_ed25519", "credentials.json",
  "service-account.json", ".dev.vars", ".env", ".npmrc", ".yarnrc",
]);

export const BLOCKED_EXTS = [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"];

export function isBlocked(relPath: string): boolean {
  if (!relPath) return true;
  const clean = relPath.replace(/\\/g, "/");
  const parts = clean.split("/").filter(Boolean);
  if (parts.some((p) => BLOCKED_DIRS.has(p))) return true;
  if (parts.some((p) => BLOCKED_BASENAMES.has(p))) return true;
  if (parts.some((p) => BLOCKED_EXTS.some((ext) => p.endsWith(ext)))) return true;
  if (parts.some((p) => p === ".env" || (p.startsWith(".env.") && p !== ".env.example"))) return true;
  return false;
}

export function safeRelPath(p: string | null | undefined): string | null {
  if (!p) return null;
  const clean = p.replace(/\\/g, "/");
  if (clean.split("/").includes("..")) return null;
  if (clean.startsWith("/")) return null;
  const segs: string[] = [];
  for (const s of clean.split("/")) {
    if (s === "..") return null;
    if (s === "." || s === "") continue;
    // Reject NUL / control chars
    if (/[\x00-\x1f]/.test(s)) return null;
    segs.push(s);
  }
  const out = segs.join("/");
  if (!out) return null;
  if (isBlocked(out)) return null;
  return out;
}

export function safeProj(proj: string | null | undefined): string | null {
  if (!proj) return null;
  if (proj.includes("/") || proj.includes("\\") || proj.includes("..")) return null;
  const trimmed = proj.trim();
  if (!trimmed || trimmed === ".") return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizeUploadPath(raw: string, proj: string): string | null {
  const safe = safeRelPath(raw);
  if (!safe) return null;
  const parts = safe.split("/");
  if (parts.length > 1 && parts[0].toLowerCase() === proj.toLowerCase()) {
    return safeRelPath(parts.slice(1).join("/"));
  }
  return safe;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bufToHex(buf);
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  // Cast for TS DOM lib strictness (Uint8Array<ArrayBufferLike> vs BufferSource).
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return bufToHex(buf);
}

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/// Length-safe constant-time string compare.
/// Pads to the longer length so timing doesn't leak length, then compares all bytes.
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const max = Math.max(aBytes.length, bBytes.length);
  let result = aBytes.length ^ bBytes.length; // length difference flag
  for (let i = 0; i < max; i++) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    result |= av ^ bv;
  }
  return result === 0;
}

export function checkAuth(request: Request): { ok: boolean; dev: boolean } {
  const token = process.env.TINYHUB_TOKEN;
  // Dev mode: no token configured -> allow writes, flag as dev.
  if (!token) return { ok: true, dev: true };
  const authHeader = request.headers.get("Authorization") || "";
  const expected = `Bearer ${token}`;
  return { ok: timingSafeEqual(authHeader, expected), dev: false };
}
