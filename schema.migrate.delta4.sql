-- schema.migrate.delta4.sql
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS commits_new (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  proj TEXT NOT NULL,
  hash12 TEXT NOT NULL,
  parent_hash12 TEXT,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete'
);

INSERT INTO commits_new (id, user, proj, hash12, parent_hash12, author, message, stats_json, created_at, status)
  SELECT id, user, proj, hash12, parent_hash12, author, message, stats_json, 
         CASE WHEN created_at < 2000000000 THEN created_at * 1000 ELSE created_at END,
         'complete'
  FROM commits;

CREATE TABLE IF NOT EXISTS commit_files_new (
  commit_id TEXT NOT NULL,
  path TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('added','modified','deleted')),
  FOREIGN KEY (commit_id) REFERENCES commits_new(id) ON DELETE CASCADE
);

INSERT INTO commit_files_new (commit_id, path, change_type)
  SELECT commit_id, path, change_type FROM commit_files;

DROP TABLE commit_files;
DROP TABLE commits;

ALTER TABLE commits_new RENAME TO commits;
ALTER TABLE commit_files_new RENAME TO commit_files;

CREATE INDEX IF NOT EXISTS idx_commits_user_proj ON commits(user, proj, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commits_hash ON commits(hash12);
CREATE INDEX IF NOT EXISTS idx_commit_files_commit ON commit_files(commit_id);

PRAGMA foreign_keys = ON;
