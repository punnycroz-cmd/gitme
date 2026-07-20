ALTER TABLE commits ADD COLUMN parent_hash12 TEXT;
CREATE INDEX IF NOT EXISTS idx_commits_hash ON commits(hash12);
