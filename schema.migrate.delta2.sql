-- Add ON DELETE CASCADE to commit_files FK
-- SQLite cannot ALTER TABLE to modify FK constraints, so recreate the table.
BEGIN TRANSACTION;
CREATE TABLE commit_files_new (
  commit_id TEXT NOT NULL,
  path TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('added','modified','deleted')),
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
);
INSERT INTO commit_files_new (commit_id, path, change_type)
  SELECT commit_id, path, change_type FROM commit_files;
DROP TABLE commit_files;
ALTER TABLE commit_files_new RENAME TO commit_files;
CREATE INDEX IF NOT EXISTS idx_commit_files_commit ON commit_files(commit_id);
COMMIT;
