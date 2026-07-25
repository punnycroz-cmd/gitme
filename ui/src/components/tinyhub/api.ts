// TinyHub — typed fetch wrappers for every backend endpoint.
// All requests use relative paths. Optional Bearer token from localStorage
// (`tinyhub_token`) is attached to writes (and reads that need auth).

import type {
  BlameResponse,
  CommitDiffResponse,
  CommitHistoryEntry,
  CommitResult,
  CompareDiffResponse,
  ConfigResponse,
  DumpJsonResponse,
  GlobalSearchResponse,
  HealthResponse,
  ProjectSummary,
  SearchResponse,
  TipResponse,
  TreeNode,
  TreeResponse,
  UploadMode,
} from "./types";

const TOKEN_KEY = "tinyhub_token";
const AUTHOR_KEY = "tinyhub_author";

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(t: string): void {
  if (typeof window === "undefined") return;
  if (t) window.localStorage.setItem(TOKEN_KEY, t);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/// The author name to attribute commits to (from Settings). Empty = use server default.
export function getAuthor(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTHOR_KEY) || "";
}

export function setAuthor(a: string): void {
  if (typeof window === "undefined") return;
  const trimmed = a.trim().slice(0, 100);
  if (trimmed) window.localStorage.setItem(AUTHOR_KEY, trimmed);
  else window.localStorage.removeItem(AUTHOR_KEY);
}

function authHeaders(includeAuth: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (includeAuth) {
    const t = getToken();
    if (t) h["Authorization"] = `Bearer ${t}`;
  }
  return h;
}

async function getJson<T>(path: string, includeAuth = false): Promise<T> {
  const res = await fetch(path, {
    headers: { Accept: "application/json", ...authHeaders(includeAuth) },
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function getHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>("/api/health");
}

export async function getConfig(): Promise<ConfigResponse> {
  return getJson<ConfigResponse>("/api/config");
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return getJson<ProjectSummary[]>("/api/projects");
}

export async function getTip(proj: string): Promise<TipResponse> {
  const p = encodeURIComponent(proj);
  return getJson<TipResponse>(`/api/projects/${p}/tip`);
}

export interface TreeQuery {
  meta?: boolean;
  flat?: boolean;
  path?: string;
  page?: number;
  pageSize?: number;
}

export async function getTree(proj: string, q: TreeQuery = {}): Promise<TreeResponse> {
  const p = encodeURIComponent(proj);
  const params = new URLSearchParams();
  if (q.meta) params.set("meta", "1");
  if (q.flat) params.set("flat", "1");
  if (q.path) params.set("path", q.path);
  if (q.page) params.set("page", String(q.page));
  if (q.pageSize) params.set("pageSize", String(q.pageSize));
  return getJson<TreeResponse>(`/api/projects/${p}/tree?${params.toString()}`);
}

/** Fetch raw file bytes as ArrayBuffer. */
export async function getFileBytes(proj: string, path: string): Promise<ArrayBuffer> {
  const p = encodeURIComponent(proj);
  const res = await fetch(
    `/api/projects/${p}/file?path=${encodeURIComponent(path)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  return res.arrayBuffer();
}

/** Fetch raw file as text. */
export async function getFileText(proj: string, path: string): Promise<string> {
  const buf = await getFileBytes(proj, path);
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export function fileUrl(proj: string, path: string): string {
  return `/api/projects/${encodeURIComponent(proj)}/file?path=${encodeURIComponent(path)}`;
}

export interface HistoryQuery {
  page?: number;
  pageSize?: number;
  date?: string; // YYYY-MM-DD filter
}

export async function getHistory(
  proj: string,
  q: HistoryQuery = {}
): Promise<CommitHistoryEntry[]> {
  const p = encodeURIComponent(proj);
  const params = new URLSearchParams();
  if (q.page) params.set("page", String(q.page));
  if (q.pageSize) params.set("pageSize", String(q.pageSize));
  if (q.date) params.set("date", q.date);
  // Backend returns { page, pageSize, total, commits: [...] }; extract the array.
  const data = await getJson<
    | CommitHistoryEntry[]
    | { page: number; pageSize: number; total: number; commits: CommitHistoryEntry[] }
  >(`/api/projects/${p}/history?${params.toString()}`);
  if (Array.isArray(data)) return data;
  return data?.commits ?? [];
}

/** Per-commit file diff (added / modified / deleted + before/after content). */
export async function getCommitDiff(
  proj: string,
  hash: string
): Promise<CommitDiffResponse> {
  const p = encodeURIComponent(proj);
  const h = encodeURIComponent(hash);
  return getJson<CommitDiffResponse>(
    `/api/projects/${p}/commit/${h}`
  );
}

/**
 * Compare two commits — diff between any two commits (older `from` → newer `to`).
 * Returns the same shape as `getCommitDiff` so the DiffViewer / CompareDiffViewer
 * can render it unchanged. The backend auto-swaps so `from` is always older.
 */
export async function getCompareDiff(
  proj: string,
  fromHash: string,
  toHash: string
): Promise<CompareDiffResponse> {
  const p = encodeURIComponent(proj);
  const params = new URLSearchParams({
    from: fromHash,
    to: toHash,
  });
  return getJson<CompareDiffResponse>(
    `/api/projects/${p}/compare?${params.toString()}`
  );
}

/** Per-file blame: line → commit attribution for the current tip content. */
export async function getBlame(
  proj: string,
  path: string
): Promise<BlameResponse> {
  const p = encodeURIComponent(proj);
  const params = new URLSearchParams({ path });
  return getJson<BlameResponse>(`/api/projects/${p}/blame?${params.toString()}`);
}

/** Export a project as a .zip Blob (files + manifest.json). */
export async function exportProject(proj: string): Promise<Blob> {
  const p = encodeURIComponent(proj);
  const res = await fetch(`/api/projects/${p}/export`, {
    headers: { Accept: "application/zip" },
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* ignore — response is likely binary */
    }
    throw new ApiError(msg, res.status);
  }
  return res.blob();
}

export async function resetProject(proj: string): Promise<{ ok: boolean }> {
  const p = encodeURIComponent(proj);
  const res = await fetch(`/api/projects/${p}/reset`, {
    method: "POST",
    headers: authHeaders(true),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status);
  }
  return (await res.json()) as { ok: boolean };
}

export interface SearchQuery {
  q: string;
  regex?: boolean;
  max?: number;
  path?: string;
}

export async function searchProject(proj: string, q: SearchQuery): Promise<SearchResponse> {
  const p = encodeURIComponent(proj);
  const params = new URLSearchParams({ q: q.q });
  if (q.regex) params.set("regex", "1");
  if (q.max) params.set("max", String(q.max));
  if (q.path) params.set("path", q.path);
  return getJson<SearchResponse>(`/api/projects/${p}/search?${params.toString()}`);
}

/// Global search across ALL projects (no project required). Returns matches
/// grouped by project.
export async function searchGlobal(
  q: SearchQuery
): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams({ q: q.q });
  if (q.regex) params.set("regex", "1");
  if (q.max) params.set("max", String(q.max));
  return getJson<GlobalSearchResponse>(`/api/search?${params.toString()}`);
}

export interface UploadArgs {
  proj: string;
  files: File[];
  mode: UploadMode;
  message: string;
  baseTip?: string | null;
  incremental?: boolean;
  deletes?: string[];
  encodings?: Record<string, string>;
  onProgress?: (sent: number, total: number) => void;
}

export async function uploadProject(args: UploadArgs): Promise<CommitResult> {
  const p = encodeURIComponent(args.proj);
  const fd = new FormData();
  for (const f of args.files) {
    fd.append("files[]", f, f.name);
  }
  fd.set("mode", args.mode);
  if (args.message) fd.set("message", args.message);
  if (args.baseTip) fd.set("baseTip", args.baseTip);
  if (args.incremental) fd.set("incremental", "1");
  if (args.deletes && args.deletes.length) fd.set("deletes", JSON.stringify(args.deletes));
  if (args.encodings) fd.set("encodings", JSON.stringify(args.encodings));
  const author = getAuthor();
  if (author) fd.set("author", author);

  // Use XHR for upload progress.
  return new Promise<CommitResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/projects/${p}/upload`);
    const t = getToken();
    if (t) xhr.setRequestHeader("Authorization", `Bearer ${t}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && args.onProgress) {
        args.onProgress(e.loaded, e.total);
      }
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as CommitResult);
      } else {
        reject(new ApiError(`HTTP ${xhr.status}`, xhr.status, body));
      }
    };
    xhr.onerror = () => reject(new ApiError("Network error", 0));
    xhr.send(fd);
  });
}

export interface CommitArgs {
  proj: string;
  message: string;
  files: Record<string, string>;
  deletes?: string[];
  baseTip?: string | null;
}

export async function commitProject(args: CommitArgs): Promise<CommitResult> {
  const p = encodeURIComponent(args.proj);
  const res = await fetch(`/api/projects/${p}/commit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders(true),
    },
    body: JSON.stringify({
      message: args.message,
      files: args.files,
      deletes: args.deletes || [],
      baseTip: args.baseTip || undefined,
      author: getAuthor() || undefined,
    }),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status, body);
  }
  return body as CommitResult;
}

export interface RenameArgs {
  proj: string;
  from: string;
  to: string;
  message?: string;
  baseTip?: string | null;
}

/// Rename/move a file via the dedicated rename endpoint. Works for binary AND text
/// files (uses raw bytes on the server side). `message` defaults server-side to
/// "Rename <from> → <to>".
export async function renameFile(args: RenameArgs): Promise<CommitResult> {
  const p = encodeURIComponent(args.proj);
  const res = await fetch(`/api/projects/${p}/rename`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders(true),
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      message: args.message || "",
      baseTip: args.baseTip || undefined,
      author: getAuthor() || undefined,
    }),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status, body);
  }
  return body as CommitResult;
}

export interface RevertArgs {
  proj: string;
  hash: string;
  message?: string;
}

export interface RevertResult {
  ok: boolean;
  empty?: boolean;
  message?: string;
  reverted?: string;
  commit?: CommitResult["commit"];
  restoredFiles?: string[];
  deletedFiles?: string[];
  missingSnapshots?: string[];
}

/// Revert a commit — creates a new commit that undoes the changes.
export async function revertCommit(args: RevertArgs): Promise<RevertResult> {
  const p = encodeURIComponent(args.proj);
  const res = await fetch(`/api/projects/${p}/revert/${args.hash}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders(true),
    },
    body: JSON.stringify({
      message: args.message || "",
      author: getAuthor() || undefined,
    }),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status, body);
  }
  return body as RevertResult;
}

export interface DumpQuery {
  mode?: "full" | "delta" | "summary";
  since?: string;
  max_tokens?: number;
  path?: string;
  format?: "json" | "html";
}

export async function getDumpJson(
  proj: string,
  q: DumpQuery
): Promise<DumpJsonResponse> {
  const p = encodeURIComponent(proj);
  const params = new URLSearchParams();
  if (q.mode) params.set("mode", q.mode);
  if (q.since) params.set("since", q.since);
  if (q.max_tokens) params.set("max_tokens", String(q.max_tokens));
  if (q.path) params.set("path", q.path);
  params.set("format", "json");
  return getJson<DumpJsonResponse>(`/api/projects/${p}/dump?${params.toString()}`);
}

export function getDumpHtmlUrl(proj: string, q: DumpQuery): string {
  const p = encodeURIComponent(proj);
  const params = new URLSearchParams();
  if (q.mode) params.set("mode", q.mode);
  if (q.since) params.set("since", q.since);
  if (q.max_tokens) params.set("max_tokens", String(q.max_tokens));
  if (q.path) params.set("path", q.path);
  params.set("format", "html");
  return `/api/projects/${p}/dump?${params.toString()}`;
}

/** Build the "// File: path" concatenation for "Copy All" / "Download". */
export function buildDumpText(dump: DumpJsonResponse): string {
  const lines: string[] = [];
  for (const [path, content] of Object.entries(dump.files || {})) {
    lines.push(`// File: ${path}`);
    lines.push(content.replace(/\s+$/, ""));
    lines.push("");
  }
  if (dump.skipped && dump.skipped.length) {
    lines.push("// Skipped:");
    for (const s of dump.skipped) {
      lines.push(`//   ${s.path} — ${s.reason}`);
    }
  }
  return lines.join("\n");
}

/** Tree → flat list of nodes (preserving tree/blob ordering). */
export function flattenTree(tree: TreeNode[]): TreeNode[] {
  return tree;
}
