# TinyHub Project Structure & Codebase Map

This document describes the directory layout, files, and core functions of the TinyHub project. External AI agents should use this map to understand which files to review and edit.

---

## Directory Overview

```
gitme/
├── src/
│   ├── index.js          # Cloudflare Worker (R2 + D1 API & SSR)
│   ├── storage.js        # R2 file helpers
│   └── security.js       # Path validation + hashing
├── public/              # Static frontend (served by Worker ASSETS binding)
│   ├── index.html        # Upload portal
│   ├── browser-template.html  # Repository browser (SSR)
│   ├── dump-template.html     # AI dump page (SSR)
│   ├── app.js           # Client-side uploader & preview logic
│   └── style.css        # Global CSS variables & layout styles
├── docs/
│   └── PUSH_SEMANTICS.md # Documentation of upload flow & diff semantics
├── schema.init.sql      # D1 initial schema (includes drops)
├── schema.migrate.sql   # D1 migration schema (safe, no drops)
├── wrangler.toml        # Worker config (R2 + D1 bindings)
├── package.json         # Wrangler dependency
├── .dev.vars            # Local dev secrets (TINYHUB_TOKEN)
└── .gitignore
```

---

## File Registry & Functions

### Core Backend (Cloudflare Worker)

#### [src/index.js](file:///Users/sema/Documents/code/work/gitme/src/index.js)
- **Role**: Cloudflare Worker router and handler.
- **Functionality**:
  - Implements API endpoints under `/api/` (config, projects, tree, history, commit, reset, raw files).
  - Performs server-side rendering (SSR) of browser and dump templates using the static assets binding (`env.ASSETS`).
  - Restricts access via timing-safe Bearer token checks (`TINYHUB_TOKEN`).

#### [src/storage.js](file:///Users/sema/Documents/code/work/gitme/src/storage.js)
- **Role**: R2 storage interface.
- **Functionality**: Encapsulates listing project files, fetching object metadata (size, custom SHA-256 hashes), and writing new files to the `FILES` bucket binding.

#### [src/security.js](file:///Users/sema/Documents/code/work/gitme/src/security.js)
- **Role**: Security & path validation.
- **Functionality**:
  - Blocklists files by directory name, file extension, or suffix (e.g. `.env`, credentials).
  - Sanitizes relative path names to prevent path traversal attacks.
  - Implements cryptographically secure SHA-256 hashing.

### Frontend Components (Static Assets)

All frontend assets are located in the `public/` directory, which is uploaded alongside the worker and served dynamically via Workers Assets.

#### [public/index.html](file:///Users/sema/Documents/code/work/gitme/public/index.html)
- **Role**: TinyHub landing page & folder uploader portal.

#### [public/browser-template.html](file:///Users/sema/Documents/code/work/gitme/public/browser-template.html)
- **Role**: SSR layout for the repository explorer and previewer.

#### [public/dump-template.html](file:///Users/sema/Documents/code/work/gitme/public/dump-template.html)
- **Role**: SSR layout for the flat AI-reviewer dump page.

#### [public/app.js](file:///Users/sema/Documents/code/work/gitme/public/app.js)
- **Role**: Client-side application controller.
- **Functionality**: Manages file select dialogs, folder dropping, AJAX uploads, and dialog modals.

#### [public/style.css](file:///Users/sema/Documents/code/work/gitme/public/style.css)
- **Role**: Style sheet.
- **Functionality**: Defines responsive 2-column layouts, colors, variables, and dark/light/twilight themes.
