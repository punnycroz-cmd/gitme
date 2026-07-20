# TinyHub - Cloudflare Only

## Stack
* **Runtime**: Cloudflare Worker
* **Storage**: Cloudflare R2 (`FILES` bucket binding)
* **Database**: Cloudflare D1 SQL Database (`DB` binding)
* **Assets**: Cloudflare Workers Assets (`ASSETS` binding)

## Local Development
To run a local simulation of the Worker, D1 DB, and R2 storage bucket:
```bash
npx wrangler dev
```
*(Note: Create a `.dev.vars` file in the root workspace containing `TINYHUB_TOKEN=your_token` to configure the authentication token for local commits/resets).*

## Deploy
To deploy to your production Cloudflare environment:
```bash
npx wrangler deploy
```

## Environment Variables / Secrets
* `TINYHUB_USER`: Set to the default username (e.g. `andie`).
* `TINYHUB_TOKEN`: Secure Bearer authorization token used to protect write/reset operations. Configure this secret in Cloudflare using:
  ```bash
  npx wrangler secret put TINYHUB_TOKEN
  ```

## API Contract
The API contract is identical to the original local server, but without any local `git` binary dependencies:
* `GET /api/config`
* `GET /api/projects`
* `GET /api/tree/:proj`
* `GET /api/history/:proj`
* `POST /api/upload/:proj`
* `POST /api/commit/:proj`
* `POST /api/reset/:proj`
* `GET /dump/:user/:proj/`
* `GET /p/:user/:proj/`
