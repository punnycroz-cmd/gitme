-- File registry: source of truth for current tip state
-- Replaces reliance on R2 customMetadata (which list() doesn't return)
CREATE TABLE IF NOT EXISTS files (
  user       TEXT NOT NULL,
  proj       TEXT NOT NULL,
  path       TEXT NOT NULL,
  sha256     TEXT NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,
  lines      INTEGER NOT NULL DEFAULT 0,
  commit_id  TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user, proj, path)
);
CREATE INDEX IF NOT EXISTS idx_files_user_proj ON files(user, proj);
CREATE INDEX IF NOT EXISTS idx_files_sha ON files(user, proj, sha256);
