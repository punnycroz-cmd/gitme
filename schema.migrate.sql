CREATE TABLE IF NOT EXISTS projects (
  user TEXT NOT NULL,
  proj TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  files_count INTEGER NOT NULL DEFAULT 0,
  commits_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user, proj)
);

CREATE TABLE IF NOT EXISTS commits (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  proj TEXT NOT NULL,
  hash12 TEXT NOT NULL,
  parent_hash12 TEXT,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commits_user_proj ON commits(user, proj, created_at DESC);

CREATE TABLE IF NOT EXISTS commit_files (
  commit_id TEXT NOT NULL,
  path TEXT NOT NULL,
  change_type TEXT NOT NULL,
  FOREIGN KEY (commit_id) REFERENCES commits(id)
);
CREATE INDEX IF NOT EXISTS idx_commit_files_commit ON commit_files(commit_id);
