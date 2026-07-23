# TinyHub push semantics

Upload is **git push for a single `main` branch**, not “overwrite a folder.”

## Contract

| Action | Behavior |
|--------|----------|
| First push | Creates tip tree + commit |
| Re-push with edits | New commit; only changed files rewritten |
| Re-push after local delete | **Remote file deleted** (`mode=push`) |
| Identical re-push | `empty: true` — *Everything up-to-date*, no commit |
| Unchanged files | Skipped (content SHA-256 match) |

## Modes

| Mode | Deletes remote-only paths? |
|------|----------------------------|
| `push` (default) | Yes |
| `merge` | No |
| `replace` | Wipe tip, then write incoming tree |

## API

### Push (folder)

```http
POST /api/upload/:project
Content-Type: multipart/form-data

files: <multiple>
message: optional commit message
mode: push | merge | replace
```

**Success (changed):**

```json
{
  "ok": true,
  "empty": false,
  "project": "my-app",
  "mode": "push",
  "saved": ["public/app.js"],
  "deleted": ["old.html"],
  "commit": { "hash": "a1b2c3d4e5f6", "message": "...", "stats": { "added": 0, "modified": 1, "deleted": 1, "unchanged": 10, "totalFiles": 11 } },
  "stats": { "added": 0, "modified": 1, "deleted": 1, "unchanged": 10, "totalFiles": 11 },
  "changes": { "added": [], "modified": ["public/app.js"], "deleted": ["old.html"], "unchanged": ["..."] },
  "blocked": []
}
```

**Up-to-date:**

```json
{
  "ok": true,
  "empty": true,
  "message": "Everything up-to-date",
  "project": "my-app",
  "stats": { "added": 0, "modified": 0, "deleted": 0, "unchanged": 12, "totalFiles": 12 }
}
```

### Tree with hashes (push preview)

```http
GET /api/tree/:project?meta=1
```

```json
{
  "project": "my-app",
  "commit": "a1b2c3d4e5f6",
  "files": [{ "path": "src/index.js", "size": 1234, "sha256": "..." }],
  "count": 1
}
```

### Partial write (AI)

```http
POST /api/commit/:project
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "AI update",
  "files": { "src/a.js": "..." },
  "deletes": ["old.js"]
}
```

Does **not** delete paths merely omitted from `files` — only explicit `deletes`. Full-tree sync is `POST /api/upload`.

## Worker storage

- Files (R2): `projects/{user}/{proj}/{path}`
- Database (D1):
  - `projects`: Tracks project metadata, files count, commits count, and last updated time.
  - `commits`: Stores commit logs, short hash (hash12), authors, messages, and timestamps.
  - `commit_files`: Tracks individual file changes (added, modified, deleted) per commit.

## Hash

SHA-256 of **raw file bytes**, hex lowercase.

## Breaking change

Default mode **push** removes remote files that are not in the uploaded folder. Use `mode=merge` for the old "only add/overwrite" behavior.

## AI Interaction Pattern (for web-crawling AIs)

The optimal pattern for an AI to read a project with minimal tokens:

### 1. Summary — project structure (~2K tokens)
```
GET /dump/<user>/<proj>/?mode=summary
```
Returns file paths, sizes, line counts — no content. The AI decides which files to read.

### 2. Search — find relevant code (~1-3K tokens)
```
GET /api/search/<proj>?q=checkAuth
GET /api/search/<proj>?q=function&regex=1&path=src
```
Grep-like search across all text files. Returns matching lines with file paths and line numbers.

### 3. Read — targeted file fetch (~5-15K tokens per file)
```
GET /api/file/<proj>?path=src/index.js
```
Fetch only the files relevant to the task.

### 4. Delta — what changed since last visit (~2-10K tokens)
```
GET /dump/<user>/<proj>/?mode=delta&since=<hash12>
```
Only files that changed since the specified commit.

### 5. Token-budgeted dump — fit within context window
```
GET /dump/<user>/<proj>/?max_tokens=10000
```
Returns smallest/most-changed files that fit within the token budget. Response includes `tokenEstimate`.

### 6. Write — send changes back
```
POST /api/commit/<proj>
Authorization: Bearer <token>
{ "message": "Fix auth bug", "files": { "src/index.js": "..." }, "deletes": [] }
```

**Total for a typical task: ~10-30K tokens** (vs 500K+ for full dump)
