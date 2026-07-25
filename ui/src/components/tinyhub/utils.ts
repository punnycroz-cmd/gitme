// TinyHub — client-side utilities (formatting, file detection, etc.)

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return "—";
  if (bytes < 1) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return n.toLocaleString("en-US");
}

export function fileExt(name: string): string {
  const base = name.split("/").pop() || name;
  return base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
}

export function fileBaseName(name: string): string {
  return name.split("/").pop() || name;
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"]);
export function isImageFile(path: string): boolean {
  return IMAGE_EXTS.has(fileExt(path));
}

const TEXT_EXTS = new Set([
  "js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "json", "md", "markdown", "html",
  "htm", "css", "scss", "sass", "less", "toml", "yml", "yaml", "txt", "rules",
  "xml", "svg", "sh", "bash", "zsh", "sql", "go", "rs", "java", "c", "cc", "cpp",
  "h", "hpp", "rb", "php", "lua", "r", "kt", "swift", "dart", "vue", "svelte",
  "astro", "ini", "cfg", "conf", "gitignore", "env", "lock", "log", "csv",
]);
export function isTextFile(path: string): boolean {
  const ext = fileExt(path);
  if (TEXT_EXTS.has(ext)) return true;
  if (!ext) return true; // extensionless — usually text
  return false;
}

/** Map a file path to a prism language id (for syntax highlighting). */
export function detectLanguage(path: string): string {
  const ext = fileExt(path);
  const base = fileBaseName(path).toLowerCase();
  if (base === "package.json" || base === "tsconfig.json") return "json";
  if (base === ".gitignore" || base === ".npmrc" || base === ".env.example") return "bash";
  const map: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    json: "json",
    md: "text",
    markdown: "text",
    html: "markup",
    htm: "markup",
    xml: "markup",
    svg: "markup",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    toml: "toml",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    sql: "sql",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cc: "cpp",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    rb: "ruby",
    php: "php",
    lua: "lua",
    kt: "kotlin",
    swift: "swift",
    dart: "dart",
    vue: "markup",
    svelte: "markup",
    astro: "markup",
  };
  return map[ext] || "text";
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlight matches inside a code snippet by wrapping them in <mark>. */
export function highlightSnippet(
  snippet: string,
  query: string,
  useRegex: boolean
): { __html: string } {
  if (!query) return { __html: escapeHtml(snippet) };
  let re: RegExp;
  try {
    re = useRegex
      ? new RegExp(`(${query})`, "gi")
      : new RegExp(`(${escapeRegExp(query)})`, "gi");
  } catch {
    return { __html: escapeHtml(snippet) };
  }
  const escaped = escapeHtml(snippet);
  // Apply regex on escaped text — we need to escape the query too for non-regex mode.
  // For regex mode this is best-effort: highlighting after escaping may not align,
  // but for typical queries it works.
  return { __html: escaped.replace(re, '<mark class="tinyhub-mark">$1</mark>') };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return hash.length > 8 ? hash.slice(0, 8) : hash;
}

/**
 * Trigger a browser download for a Blob with the given filename.
 * Cleans up the object URL after the click so we don't leak memory.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation slightly so the download has time to start in all browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Strip a leading project-name prefix from a path (matches backend normalizeUploadPath). */
export function stripProjectPrefix(path: string, proj: string): string {
  const parts = path.split("/");
  if (parts.length > 1 && parts[0].toLowerCase() === proj.toLowerCase()) {
    return parts.slice(1).join("/");
  }
  return path;
}

/** Convert a File's webkitRelativePath or name into a clean upload path. */
export function fileToUploadPath(file: File, proj: string): string {
  const raw = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const cleaned = raw.replace(/\\/g, "/");
  return stripProjectPrefix(cleaned, proj);
}
