ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

ENV NODE_ENV=production \
  DATABASE_URL=postgres://build:build@127.0.0.1:5432/medusa_build \
  REDIS_URL=redis://127.0.0.1:6379 \
  JWT_SECRET=build-only-jwt-secret-not-used-at-runtime \
  COOKIE_SECRET=build-only-cookie-secret-not-used-at-runtime \
  STORE_CORS=http://localhost:8000 \
  ADMIN_CORS=http://localhost:9000 \
  AUTH_CORS=http://localhost:9000 \
  S3_BUCKET=build-only-medusa \
  S3_REGION=us-east-1 \
  S3_FILE_URL=http://localhost:9000/static \
  S3_ACCESS_KEY_ID=build-only \
  S3_SECRET_ACCESS_KEY=build-only

RUN corepack enable

COPY . .
RUN yarn install --immutable \
  && yarn build \
  && npm run build --prefix deployment/medusa-backend \
  && yarn workspaces focus @medusajs/production-backend --production

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /repo/deployment/medusa-backend/.medusa/server

COPY --from=build --chown=node:node /repo/node_modules /repo/node_modules
COPY --from=build --chown=node:node /repo/packages /repo/packages
COPY --from=build --chown=node:node /repo/deployment/medusa-backend /repo/deployment/medusa-backend

USER node

EXPOSE 9000

CMD ["sh", "-c", "npx medusa db:migrate && exec npm start"]
