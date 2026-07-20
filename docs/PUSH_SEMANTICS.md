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

Default mode **push** removes remote files that are not in the uploaded folder. Use `mode=merge` for the old “only add/overwrite” behavior.
