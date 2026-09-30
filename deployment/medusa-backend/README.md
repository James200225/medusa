# Production backend deployment

This directory defines a deployable Medusa application for this source
repository. The repository itself is the Medusa monorepo, not a configured
storefront/backend project. The app is a Yarn workspace and links directly to
the Medusa packages in this checkout, so its image contains the source revision
that triggered the deployment.

## Configure and run with Docker Compose

1. Copy `.env.production.example` to `.env.production` and set the PostgreSQL,
   Redis, CORS, secrets, and S3-compatible storage values. Do not commit that
   file.
2. Build and start both the API and worker:

   ```sh
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. Check the API at `http://127.0.0.1:9000/health`. Put a TLS-enabled reverse
   proxy in front of this loopback-only listener before serving public traffic.

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
