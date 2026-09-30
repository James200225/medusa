import { NextRequest } from "next/server"

type RouteContext = {
  params: Promise<{ path: string[] }>
}

async function proxyToMedusa(request: NextRequest, context: RouteContext) {
  const publishableKey = process.env.MEDUSA_PUBLISHABLE_KEY
  if (!publishableKey) {
    return Response.json(
      {
        message:
          "Falta configurar MEDUSA_PUBLISHABLE_KEY en apps/storefront/.env.local.",
      },
      { status: 503 }
    )
  }

  const backendUrl = process.env.MEDUSA_BACKEND_URL ?? "http://127.0.0.1:9000"
  const { path } = await context.params
  const pathname = path.map(encodeURIComponent).join("/")
  const target = new URL(
    `/` + pathname + request.nextUrl.search,
    backendUrl.endsWith("/") ? backendUrl : `${backendUrl}/`
  )
  const headers = new Headers({
    accept: "application/json",
    "x-publishable-api-key": publishableKey,
  })
  const cookie = request.headers.get("cookie")
  const authorization = request.headers.get("authorization")
  if (cookie) {
    headers.set("cookie", cookie)
  }
  if (authorization) {
    headers.set("authorization", authorization)
  }
  const contentType = request.headers.get("content-type")
  if (contentType) {
    headers.set("content-type", contentType)
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text(),
      cache: "no-store",
    })

    const responseHeaders = new Headers({
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    })
    for (const setCookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", setCookie)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch {
    return Response.json(
      {
        message:
          "No pudimos conectarnos con la tienda. Revisa que el backend Medusa esté activo.",
      },
      { status: 502 }
    )
  }
}

export const GET = proxyToMedusa
export const POST = proxyToMedusa
export const DELETE = proxyToMedusa
