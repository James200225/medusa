export type StoreCategory = {
  id: string
  name: string
  handle: string
}

export type StoreVariant = {
  id: string
  title: string
  inventory_quantity?: number | null
  manage_inventory?: boolean
  calculated_price?: {
    calculated_amount: number
    currency_code: string
  }
}

export type StoreProduct = {
  id: string
  title: string
  handle: string
  description?: string | null
  thumbnail?: string | null
  images?: { url: string }[]
  metadata?: Record<string, unknown> | null
  categories?: StoreCategory[]
  variants?: StoreVariant[]
}

export type CartLine = {
  id: string
  title: string
  product_title?: string
  variant_title?: string
  variant_id?: string | null
  product_id?: string | null
  quantity: number
  unit_price: number
  metadata?: Record<string, unknown> | null
  thumbnail?: string | null
}

export type StoreCart = {
  id: string
  currency_code: string
  region_id?: string
  sales_channel_id?: string | null
  total: number
  subtotal: number
  shipping_total?: number
  item_subtotal?: number
  items: CartLine[]
}

export type StoreRegion = {
  id: string
  name: string
  currency_code: string
  countries?: { iso_2: string }[]
}

export type DeliveryCoverage = {
  has_coverage: boolean
  sales_channel_id?: string
  estimated_delivery_time?: string
  message?: string
}

type ApiError = { message?: string; error?: string }

export async function storeApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`/api/medusa${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  })
  const body = (await response.json().catch(() => ({}))) as T & ApiError

  if (!response.ok) {
    throw new Error(
      body.message ??
        body.error ??
        `La tienda respondió con un error (${response.status}).`
    )
  }

  return body
}

export function cartFields() {
  return new URLSearchParams({
    fields:
      "id,currency_code,region_id,sales_channel_id,total,subtotal,shipping_total,items.id,items.thumbnail,items.product_id,items.variant_id,items.title,items.product_title,items.variant_title,items.quantity,items.unit_price,items.metadata",
  }).toString()
}

export function money(amount: number, currency = "USD") {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}
