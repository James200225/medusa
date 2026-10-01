import assert from "node:assert/strict"
import net from "node:net"
import test from "node:test"
import { checkProductionReadiness } from "./check-prod-readiness.mjs"

function captureOutput(run) {
  const originalLog = console.log
  const originalError = console.error
  console.log = () => {}
  console.error = () => {}
  return run().finally(() => {
    console.log = originalLog
    console.error = originalError
  })
}

async function createRedisServer() {
  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      const request = data.toString("utf8")
      socket.write(request.includes("$4\r\nPING\r\n") ? "+PONG\r\n" : "+OK\r\n")
    })
  })

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })

  const address = server.address()
  assert.ok(address && typeof address !== "string")
  return {
    server,
    url: `redis://readiness-user:readiness-password@127.0.0.1:${address.port}`,
  }
}

function validEnvironment(redisUrl) {
  return {
    DATABASE_URL:
      "postgresql://prod_user:secure-db-password@db.example.com:5432/medusa?sslmode=verify-full",
    REDIS_URL: redisUrl,
    MEDUSA_PUBLISHABLE_KEY: "pk_live_readiness-test",
    JWT_SECRET: "jwt-secret-with-at-least-thirty-two-characters",
    COOKIE_SECRET: "cookie-secret-with-at-least-thirty-two-characters",
    S3_ACCESS_KEY_ID: "production-access-key",
    S3_SECRET_ACCESS_KEY: "production-secret-key",
  }
}

test("passes with PostgreSQL SSL, a publishable key, non-default credentials, and Redis PING", async (t) => {
  const redis = await createRedisServer()
  t.after(() => redis.server.close())
  assert.equal(
    await captureOutput(() =>
      checkProductionReadiness(validEnvironment(redis.url))
    ),
    true
  )
})

test("rejects a database URL without SSL and a missing publishable key", async (t) => {
  const redis = await createRedisServer()
  t.after(() => redis.server.close())
  const env = validEnvironment(redis.url)
  env.DATABASE_URL =
    "postgresql://prod_user:secure-db-password@db.example.com/medusa"
  delete env.MEDUSA_PUBLISHABLE_KEY

  assert.equal(await captureOutput(() => checkProductionReadiness(env)), false)
})

test("rejects known development/default credentials", async (t) => {
  const redis = await createRedisServer()
  t.after(() => redis.server.close())
  const env = validEnvironment(redis.url)
  env.COOKIE_SECRET = "replace-with-a-different-long-random-secret"
  env.DATABASE_URL =
    "postgresql://prod_user:password@db.example.com:5432/medusa?sslmode=require"

  assert.equal(await captureOutput(() => checkProductionReadiness(env)), false)
})
