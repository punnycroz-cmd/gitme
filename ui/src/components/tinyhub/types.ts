// TinyHub — TypeScript types matching the backend API contract.

export type ViewKey =
  | "dashboard"
  | "browser"
  | "upload"
  | "history"
  | "dump"
  | "search";

export interface HealthResponse {
  status: string;
  user: string;
  timestamp: number;
}

export interface Limits {
  MAX_FILE_SIZE?: number;
  MAX_COMMIT_PAYLOAD?: number;
  DUMP_MAX_FILE_SIZE?: number;
  DUMP_MAX_FILES?: number;
  DUMP_MAX_TOTAL?: number;
  SEARCH_MAX_FILE_SIZE?: number;
  SEARCH_MAX_FILES?: number;
  SEARCH_MAX_MATCHES?: number;
  MAX_MESSAGE_LEN?: number;
  MAX_DELETES?: number;
  MAX_FILES_PER_COMMIT?: number;
  TREE_DEFAULT_PAGE_SIZE?: number;
  HISTORY_DEFAULT_PAGE_SIZE?: number;
  [k: string]: number | undefined;
}

export interface ConfigResponse {
  user: string;
  limits: Limits;
  apiBase?: string;
}

export interface ProjectSummary {
  name: string;
  updatedAt: number; // ms
  filesCount: number;
  commitsCount: number;
  lastCommit: string | null;
  totalBytes: number; // real sum of FileBlob sizes
}

export interface TipResponse {
  commit: string | null;
  created_at: number | null;
}

export type TreeNode = {
  path: string;
  type: "tree" | "blob";
  size?: number | null;
};

export interface TreeResponse {
  paths?: string[];
  tree?: TreeNode[];
  files?: { path: string; size: number; sha256: string; lines: number }[];
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface CommitHistoryEntry {
  id: string;
  hash: string;
  parent: string | null;
  author: string;
  message: string;
  stats: { added: number; modified: number; deleted: number; unchanged: number };
  date: string; // ISO
}

export interface CommitResult {
  ok: boolean;
  empty?: boolean;
  project: string;
  mode: string;
  blocked: string[];
  saved: string[];
  deleted: string[];
  added: string[];
  modified: string[];
  commit: {
    hash: string;
    message: string;
    author: string;
    stats: { added: number; modified: number; deleted: number; unchanged: number };
  };
  stats: { added: number; modified: number; deleted: number; unchanged: number };
  changes: { added: string[]; modified: string[]; deleted: string[] };
  remoteTip?: string;
}

export interface SearchMatch {
  path: string;
  line: number;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  matches: SearchMatch[];
  count: number;
  truncated: boolean;
}

export interface GlobalSearchMatch extends SearchMatch {
  project: string;
}

export interface GlobalSearchProjectResult {
  project: string;
  count: number;
  matches: GlobalSearchMatch[];
}

export interface GlobalSearchResponse {
  query: string;
  regex: boolean;
  matches: GlobalSearchMatch[];
  projects: GlobalSearchProjectResult[];
  count: number;
  projectsSearched: number;
  filesCapPerProject: number;
  truncated: boolean;
}

export interface DumpSkipped {
  path: string;
  reason: string;
  size?: number;
}

export interface DumpJsonResponse {
  repo: string;
  type: string;
  commit: string | null;
  createdAt: number | null;
  files: Record<string, string>;
  skipped: DumpSkipped[];
}

export type CommitDiffChangeType = "added" | "modified" | "deleted";

export interface CommitDiffFile {
  path: string;
  changeType: CommitDiffChangeType;
  /** Pre-commit content for modified files. null = unavailable (v1 limitation). */
  before: string | null;
  /** Post-commit content. null = file was deleted (or no longer exists). */
  after: string | null;
  /** Size of the after-content in bytes (0 for deleted). */
  size: number;
}

export interface CommitDiffResponse {
  hash: string;
  parentHash: string | null;
  author: string;
  message: string;
  /** ms since epoch */
  createdAt: number;
  stats: { added: number; modified: number; deleted: number; unchanged: number };
  files: CommitDiffFile[];
  /** true when this commit is the current tip of the project. */
  isTip: boolean;
  /** Human-readable explanation of the before/after limitations. */
  note: string;
}

/**
 * Response shape for the commit-comparison endpoint
 * (/api/projects/:proj/compare?from=...&to=...). Identical to CommitDiffResponse
 * so the same DiffViewer / CompareDiffViewer rendering can be reused.
 */
export type CompareDiffResponse = CommitDiffResponse;

// ─── Per-file blame view ─────────────────────────────────────────────────────

export interface BlameCommit {
  hash: string;
  author: string;
  message: string;
  /** epoch milliseconds */
  createdAt: number;
  /** # of lines in the current tip content blamed to this commit */
  count: number;
}

export interface BlameLineCommit {
  hash: string;
  author: string;
  message: string;
  /** epoch milliseconds */
  createdAt: number;
}

export interface BlameLine {
  /** 1-based line number */
  line: number;
  content: string;
  /** The commit that last touched this line, or null if unknown. */
  commit: BlameLineCommit | null;
}

export interface BlameResponse {
  path: string;
  totalLines: number;
  commits: BlameCommit[];
  lines: BlameLine[];
  truncated: boolean;
}

export type UploadMode = "push" | "merge" | "replace";

export interface UploadedFilePreview {
  path: string;
  size: number;
  blocked: boolean;
  reason?: string;
  file?: File;
}
