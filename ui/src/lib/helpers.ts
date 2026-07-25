// TinyHub — helpers: MIME, html escape, tree, cors, json.

export const MIME_MAP: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  ts: "application/typescript; charset=utf-8",
  tsx: "application/typescript; charset=utf-8",
  jsx: "text/javascript; charset=utf-8",
  py: "text/x-python; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  toml: "application/toml; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  yaml: "text/yaml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  rules: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  pdf: "application/pdf",
  wasm: "application/wasm",
  sql: "application/sql; charset=utf-8",
  sh: "text/x-shellscript; charset=utf-8",
};

export function guessContentType(filePath: string): string {
  const base = filePath.split("/").pop() || filePath;
  if (base === ".firebaserc" || base === ".npmrc") return "application/json; charset=utf-8";
  if (
    base === ".gitignore" ||
    base === ".gitattributes" ||
    base === ".editorconfig" ||
    base === "_redirects"
  ) {
    return "text/plain; charset=utf-8";
  }
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
  return MIME_MAP[ext] || "text/plain; charset=utf-8";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function fileExt(name: string): string {
  const base = name.split("/").pop() || name;
  return base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
}

export function wantsJson(request: Request, searchParams: URLSearchParams): boolean {
  const format = (searchParams.get("format") || "").toLowerCase();
  if (format === "json" || format === "api") return true;
  if (searchParams.get("json") === "1" || searchParams.get("json") === "true") return true;
  const accept = (request.headers.get("Accept") || "").toLowerCase();
  if (accept.includes("application/json")) return true;
  const ua = (request.headers.get("User-Agent") || "").toLowerCase();
  if (
    ua.includes("curl/") ||
    ua.includes("python-requests") ||
    ua.includes("httpx") ||
    ua.includes("go-http-client") ||
    ua.includes("wget/")
  ) {
    return true;
  }
  return false;
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      ...extra,
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

export type TreeNode = { path: string; type: "tree" | "blob"; size?: number | null };

export function buildStructuredTree(
  paths: string[],
  sizes: Record<string, number | null> = {}
): { paths: string[]; tree: TreeNode[] } {
  const dirSet = new Set<string>();
  for (const p of paths) {
    const segs = p.split("/");
    for (let i = 1; i < segs.length; i++) dirSet.add(segs.slice(0, i).join("/"));
  }
  const tree: TreeNode[] = [
    ...[...dirSet].sort().map((path) => ({ path, type: "tree" as const })),
    ...paths.slice().sort().map((path) => ({ path, type: "blob" as const, size: sizes[path] ?? null })),
  ];
  return { paths, tree };
}

export function safeJsonParse<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function countLines(bytes: Uint8Array): number {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (text.length === 0) return 0;
  return text.split("\n").length;
}
