# Production backend deployment

This directory defines a deployable Medusa application for this source
repository. The repository itself is the Medusa monorepo, not a configured
storefront/backend project. The app is a Yarn workspace and links directly to
the Medusa packages in this checkout, so its image contains the source revision
that triggered the deployment.

## Configure and run with Docker Compose

1. Copy `.env.production.example` to `.env.production` and set the PostgreSQL,
   Redis, CORS, secrets, publishable key, and S3-compatible storage values. Do
   not commit that file. CORS values are comma-separated HTTP(S) origins with
   no paths; whitespace around commas is ignored. The example includes local
   storefront/Admin origins and illustrative production origins. Remove local
   origins from the production deployment if they are not needed.
2. Run `npm run check:prod-readiness` at the repository root (or
   `npm run check:prod-readiness` from this directory) before deployment. The
   check loads `.env.production` when present, confirms PostgreSQL SSL settings,
   sends an authenticated `PING` to Redis, checks `MEDUSA_PUBLISHABLE_KEY`, and
   rejects known development/default secrets without printing any values. The
   tracked example intentionally contains placeholders and should fail until
   populated with real production configuration.
3. Build and start both the API and worker:

   ```sh
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. Check the API at `http://127.0.0.1:9000/health`. Put a TLS-enabled reverse
   proxy in front of this loopback-only listener before serving public traffic.

Configure `MEDUSA_PUBLISHABLE_KEY` and `MEDUSA_BACKEND_URL` in the storefront's
own deployment environment as well; the readiness command checks that key in
the environment where it runs.

For quick-dispatch hub alerts, optionally set `QUICK_DISPATCH_WEBHOOK_URL` in
`.env.production`. The receiver gets `quick_dispatch.order_placed` events
including the order's sales channel ID. Set `QUICK_DISPATCH_WEBHOOK_SECRET` to
enable HMAC SHA-256 signature verification.

The API container runs `npx medusa db:migrate` before `npm start`. The separate
worker starts with `MEDUSA_WORKER_MODE=worker`; the API uses
`MEDUSA_WORKER_MODE=server`. Both use the same Redis-backed event bus, workflow
engine, cache, and locking, PostgreSQL database, and object storage.

## Automatic deployment to a VPS

The workflow runs on each push to `main`, installs and builds the Medusa
monorepo, builds this app's production image, and publishes it to GHCR as
`ghcr.io/<owner>/<repository>-backend`. To enable the VPS job, configure these
repository variables:

- `DEPLOY_SSH_HOST`
- `DEPLOY_SSH_USER`
- `DEPLOY_PATH` (an absolute path on the VPS)
- `DEPLOY_SSH_PORT` (optional; defaults to `22`)

Add these repository secrets:

- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_SSH_KNOWN_HOSTS` (the verified SSH host-key line for the VPS)

The VPS must have Docker Engine and the Compose plugin installed, a populated
`.env.production` file at `DEPLOY_PATH`, and permission to pull the GHCR image.
For a private GHCR package, authenticate the VPS with a read-only
`read:packages` token before the first deployment. Configure TLS, firewall
rules, backups, and monitoring on the VPS; Compose intentionally binds the
backend only to loopback for a reverse proxy.

Without `DEPLOY_SSH_HOST`, GitHub Actions still builds and publishes the image,
but skips the VPS deployment job.
