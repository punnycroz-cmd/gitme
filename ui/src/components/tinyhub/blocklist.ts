// TinyHub — client-side blocklist mirror (matches src/lib/security.ts).
// Used by the Upload view to warn the user about files that will be rejected.

const BLOCKED_DIRS = new Set([
  ".git", "node_modules", "__pycache__", "dist", "build", ".next", ".venv",
  "data", ".firebase", ".qwen", ".wrangler", "coverage", ".turbo", ".sveltekit",
  ".nuxt", ".cache",
]);

const BLOCKED_BASENAMES = new Set([
  ".DS_Store", "Thumbs.db", "id_rsa", "id_ed25519", "credentials.json",
  "service-account.json", ".dev.vars", ".env", ".npmrc", ".yarnrc",
]);

const BLOCKED_EXTS = [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"];

export interface BlockCheck {
  blocked: boolean;
  reason?: string;
}

export function isBlocked(relPath: string): BlockCheck {
  if (!relPath) return { blocked: true, reason: "empty path" };
  const clean = relPath.replace(/\\/g, "/");
  const parts = clean.split("/").filter(Boolean);
  for (const p of parts) {
    if (BLOCKED_DIRS.has(p)) return { blocked: true, reason: `directory '${p}' is blocked` };
    if (BLOCKED_BASENAMES.has(p)) return { blocked: true, reason: `file '${p}' is blocked` };
    if (BLOCKED_EXTS.some((ext) => p.endsWith(ext)))
      return { blocked: true, reason: `extension blocked: ${p.slice(p.lastIndexOf("."))}` };
    if (p === ".env" || (p.startsWith(".env.") && p !== ".env.example"))
      return { blocked: true, reason: `secrets file '${p}' is blocked` };
  }
  return { blocked: false };
}
