import net from "node:net"
import tls from "node:tls"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const DEFAULT_CREDENTIALS = new Set([
  "admin",
  "changeme",
  "change-me",
  "development",
  "dev",
  "medusa",
  "minioadmin",
  "password",
  "postgres",
  "replace-me",
  "secret",
  "supersecret",
  "test",
  "123456",
])

const failures = []

function loadProductionEnv() {
  const candidates = [
    resolve(process.cwd(), ".env.production"),
    resolve(process.cwd(), "..", "..", ".env.production"),
  ]
  const envFile = candidates.find((candidate) => {
    try {
      readFileSync(candidate)
      return true
    } catch {
      return false
    }
  })

  if (!envFile) {
    return
  }

  const contents = readFileSync(envFile, "utf8")
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/
    )
    if (!match || match[1] in process.env) {
      continue
    }
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2")
    process.env[match[1]] = value
  }
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase()
  return (
    !normalized ||
    normalized === "pk_..." ||
    normalized.includes("replace-with") ||
    normalized.includes("replace_me") ||
    normalized.includes("your-") ||
    normalized.includes("example.com") ||
    DEFAULT_CREDENTIALS.has(normalized)
  )
}

function validateDatabaseUrl(value) {
  let databaseUrl
  try {
    databaseUrl = new URL(value)
  } catch {
    return false
  }

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    !databaseUrl.hostname
  ) {
    return false
  }

  const sslMode = databaseUrl.searchParams.get("sslmode")?.toLowerCase()
  const sslEnabled = databaseUrl.searchParams.get("ssl")?.toLowerCase()
  if (sslMode) {
    return ["require", "verify-ca", "verify-full"].includes(sslMode)
  }
  return ["true", "1"].includes(sslEnabled ?? "")
}

function redisUrlFromEnvironment(value) {
  let redisUrl
  try {
    redisUrl = new URL(value)
  } catch {
    throw new Error("REDIS_URL must be a valid redis:// or rediss:// URL.")
  }

  if (
    !["redis:", "rediss:"].includes(redisUrl.protocol) ||
    !redisUrl.hostname
  ) {
    throw new Error("REDIS_URL must be a valid redis:// or rediss:// URL.")
  }

  return redisUrl
}

function readRedisLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = ""
    const cleanup = () => {
      socket.off("data", onData)
      socket.off("error", onError)
      socket.off("timeout", onTimeout)
    }
    const onData = (chunk) => {
      buffer += chunk.toString("utf8")
      const lineEnd = buffer.indexOf("\r\n")
      if (lineEnd !== -1) {
        cleanup()
        resolve(buffer.slice(0, lineEnd))
      }
    }
    const onError = () => {
      cleanup()
      reject(new Error("Redis request failed."))
    }
    const onTimeout = () => {
      cleanup()
      reject(new Error("Redis request timed out."))
    }

    socket.on("data", onData)
    socket.once("error", onError)
    socket.once("timeout", onTimeout)
  })
}

async function redisCommand(socket, ...parts) {
  const command = `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join("")}`
  socket.write(command)
  const response = await readRedisLine(socket)
  if (response.startsWith("-")) {
    throw new Error("Redis rejected the readiness-check request.")
  }
  return response
}

async function checkRedisConnection(value) {
  const redisUrl = redisUrlFromEnvironment(value)
  const port = Number(redisUrl.port || 6379)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("REDIS_URL contains an invalid port.")
  }

  const socket =
    redisUrl.protocol === "rediss:"
      ? tls.connect({
          host: redisUrl.hostname,
          port,
          ...(net.isIP(redisUrl.hostname)
            ? {}
            : { servername: redisUrl.hostname }),
        })
      : net.connect({ host: redisUrl.hostname, port })

  socket.setTimeout(5000)
  try {
    await new Promise((resolve, reject) => {
      const readyEvent =
        redisUrl.protocol === "rediss:" ? "secureConnect" : "connect"
      socket.once(readyEvent, resolve)
      socket.once("error", () => reject(new Error("Redis connection failed.")))
      socket.once("timeout", () =>
        reject(new Error("Redis connection timed out."))
      )
    })

    const username = decodeURIComponent(redisUrl.username)
    const password = decodeURIComponent(redisUrl.password)
    if (username || password) {
      const authResponse = username
        ? await redisCommand(socket, "AUTH", username, password)
        : await redisCommand(socket, "AUTH", password)
      if (authResponse !== "+OK") {
        throw new Error("Redis authentication failed.")
      }
    }

    const pingResponse = await redisCommand(socket, "PING")
    if (pingResponse !== "+PONG") {
      throw new Error("Redis did not respond to PING.")
    }
  } finally {
    socket.destroy()
  }
}

function validateNoDefaultCredentials(env) {
  const credentialVariables = [
    "JWT_SECRET",
    "COOKIE_SECRET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ]
  let valid = true

  for (const variable of credentialVariables) {
    const value = env[variable]
    if (!value) {
      fail(`${variable} must be set.`)
      valid = false
      continue
    }

    if (isPlaceholder(value)) {
      fail(`${variable} must not use a development/default value.`)
      valid = false
      continue
    }

    if (
      ["JWT_SECRET", "COOKIE_SECRET"].includes(variable) &&
      value.length < 32
    ) {
      fail(`${variable} must contain at least 32 characters.`)
      valid = false
      continue
    }
  }

  try {
    const databaseUrl = new URL(env.DATABASE_URL)
    const databasePassword = decodeURIComponent(databaseUrl.password)
    const databaseUser = decodeURIComponent(databaseUrl.username)
    if (
      (databasePassword && isPlaceholder(databasePassword)) ||
      DEFAULT_CREDENTIALS.has(databaseUser.toLowerCase())
    ) {
      fail("DATABASE_URL must not use development/default credentials.")
      valid = false
    }
  } catch {
    valid = false
  }

  try {
    const redisUrl = redisUrlFromEnvironment(env.REDIS_URL)
    const redisPassword = decodeURIComponent(redisUrl.password)
    if (redisPassword && isPlaceholder(redisPassword)) {
      fail("REDIS_URL must not use a development/default password.")
      valid = false
    }
  } catch {
    valid = false
  }

  return valid
}

export async function checkProductionReadiness(env = process.env) {
  failures.length = 0
  let valid = true

  if (!env.DATABASE_URL) {
    fail("DATABASE_URL must be set.")
    valid = false
  } else if (!validateDatabaseUrl(env.DATABASE_URL)) {
    fail("DATABASE_URL must be a PostgreSQL URL configured to use SSL.")
    valid = false
  } else {
    pass("DATABASE_URL is PostgreSQL with SSL enabled.")
  }

  if (!env.REDIS_URL) {
    fail("REDIS_URL must be set.")
    valid = false
  } else {
    try {
      await checkRedisConnection(env.REDIS_URL)
      pass("REDIS_URL is reachable and responds to PING.")
    } catch (error) {
      fail(
        error instanceof Error ? error.message : "Redis readiness check failed."
      )
      valid = false
    }
  }

  if (
    !env.MEDUSA_PUBLISHABLE_KEY ||
    isPlaceholder(env.MEDUSA_PUBLISHABLE_KEY)
  ) {
    fail("MEDUSA_PUBLISHABLE_KEY must be set to a real publishable key.")
    valid = false
  } else {
    pass("MEDUSA_PUBLISHABLE_KEY is configured.")
  }

  if (!validateNoDefaultCredentials(env)) {
    valid = false
  } else {
    pass("No known development/default credentials detected.")
  }

  if (valid) {
    console.log("Production readiness check passed.")
    return true
  }

  console.error(
    `Production readiness check failed (${failures.length} issue(s)).`
  )
  return false
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  loadProductionEnv()
  const ready = await checkProductionReadiness()
  if (!ready) {
    process.exitCode = 1
  }
}
