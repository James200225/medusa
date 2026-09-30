import { defineConfig, loadEnv } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const requiredEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} must be set`)
  }
  return value
}

const requiredCorsOrigins = (key: string) => {
  const origins = requiredEnv(key)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (!origins.length) {
    throw new Error(`${key} must contain at least one allowed origin`)
  }

  for (const origin of origins) {
    if (origin === "*") {
      continue
    }

    let parsedOrigin: URL
    try {
      parsedOrigin = new URL(origin)
    } catch {
      throw new Error(`${key} contains an invalid origin`)
    }

    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.origin !== origin
    ) {
      throw new Error(`${key} entries must be HTTP(S) origins without paths`)
    }
  }

  return origins.join(",")
}

const redisUrl = requiredEnv("REDIS_URL")

export default defineConfig({
  projectConfig: {
    databaseUrl: requiredEnv("DATABASE_URL"),
    redisUrl,
    http: {
      storeCors: requiredCorsOrigins("STORE_CORS"),
      adminCors: requiredCorsOrigins("ADMIN_CORS"),
      authCors: requiredCorsOrigins("AUTH_CORS"),
      jwtSecret: requiredEnv("JWT_SECRET"),
      cookieSecret: requiredEnv("COOKIE_SECRET"),
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/cache-redis",
      options: { redisUrl },
    },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: { redisUrl },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: { redis: { redisUrl } },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            id: "locking-redis",
            resolve: "@medusajs/medusa/locking-redis",
            is_default: true,
            options: { redisUrl },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: requiredEnv("S3_FILE_URL"),
              access_key_id: requiredEnv("S3_ACCESS_KEY_ID"),
              secret_access_key: requiredEnv("S3_SECRET_ACCESS_KEY"),
              bucket: requiredEnv("S3_BUCKET"),
              region: requiredEnv("S3_REGION"),
              endpoint: process.env.S3_ENDPOINT,
            },
          },
        ],
      },
    },
  ],
})
