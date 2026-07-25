// TinyHub — limits & config

export const LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB per file (upload)
  MAX_COMMIT_PAYLOAD: 50 * 1024 * 1024, // 50 MB JSON commit body
  DUMP_MAX_FILE_SIZE: 512 * 1024, // 512 KB per file in dump
  DUMP_MAX_FILES: 200,
  DUMP_MAX_TOTAL: 8 * 1024 * 1024, // 8 MB total dump
  SEARCH_MAX_FILE_SIZE: 256 * 1024,
  SEARCH_MAX_FILES: 100,
  SEARCH_MAX_MATCHES: 50,
  MAX_MESSAGE_LEN: 500,
  MAX_DELETES: 5000,
  MAX_FILES_PER_COMMIT: 5000,
  TREE_DEFAULT_PAGE_SIZE: 1000,
  HISTORY_DEFAULT_PAGE_SIZE: 50,
  R2_DELETE_BATCH: 1000,
} as const;

export const DEFAULT_USER = process.env.TINYHUB_USER || "andie";

// In dev (no token configured), writes are allowed but flagged.
export function isDevMode(): boolean {
  return !process.env.TINYHUB_TOKEN;
}
