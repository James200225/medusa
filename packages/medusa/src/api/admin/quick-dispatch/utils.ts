export const QUICK_DISPATCH_STATUS_KEY = "quick_dispatch_status"
export const RETURNABLE_DEPOSIT_KEY = "returnable_packaging_deposit"

type DispatchItem = {
  id: string
  product_id?: string | null
  variant_id?: string | null
  title?: string | null
  quantity: number | string
  metadata?: Record<string, unknown> | null
  line_item_metadata?: Record<string, unknown> | null
  product?: { metadata?: Record<string, unknown> | null } | null
  variant?: {
    metadata?: Record<string, unknown> | null
    product?: { metadata?: Record<string, unknown> | null } | null
  } | null
}

export type DispatchOrder = {
  id: string
  display_id: number
  status: string
  sales_channel_id?: string | null
  created_at: string | Date
  metadata?: Record<string, unknown> | null
  items?: DispatchItem[]
  shipping_address?: Record<string, unknown> | null
}

export function isQuickDispatchOrder(order: DispatchOrder): boolean {
  if (order.metadata?.[QUICK_DISPATCH_STATUS_KEY] === "ready_for_pickup") {
    return false
  }

  return (
    order.status === "requires_action" ||
    order.metadata?.[QUICK_DISPATCH_STATUS_KEY] === "pending_preparation"
  )
}

export function buildQuickDispatchOrder(order: DispatchOrder) {
  const coldItems: { id: string; title: string; quantity: number }[] = []
  let bottlesToCharge = 0

  for (const item of order.items ?? []) {
    const metadata = {
      ...(item.product?.metadata ?? {}),
      ...(item.variant?.product?.metadata ?? {}),
      ...(item.variant?.metadata ?? {}),
    }
    const itemMetadata = {
      ...(item.line_item_metadata ?? {}),
      ...(item.metadata ?? {}),
    }
    const quantity = Number(item.quantity)

    if (
      itemMetadata[RETURNABLE_DEPOSIT_KEY] === true &&
      !item.product_id &&
      !item.variant_id
    ) {
      const bottleCount = Number(itemMetadata.bottle_count ?? quantity)
      if (Number.isFinite(bottleCount) && bottleCount > 0) {
        bottlesToCharge += bottleCount
      }
      continue
    }

    if (
      metadata.is_cold === true ||
      metadata.serves_cold === true ||
      metadata.storage_temperature === "cold" ||
      metadata.temperature === "cold"
    ) {
      coldItems.push({
        id: item.id,
        title: item.title ?? "Artículo",
        quantity,
      })
    }
  }

  const packagingSummary = order.metadata?.returnable_packaging_summary as
    | Record<string, unknown>
    | undefined

  return {
    id: order.id,
    display_id: order.display_id,
    status: order.status,
    quick_dispatch_status:
      order.metadata?.[QUICK_DISPATCH_STATUS_KEY] ??
      (order.status === "requires_action"
        ? "requires_action"
        : "pending_preparation"),
    sales_channel_id: order.sales_channel_id,
    created_at: order.created_at,
    cold_items: coldItems,
    bottle_summary: {
      bottles_to_charge: bottlesToCharge,
      empty_bottles_to_collect: Number(
        packagingSummary?.empty_bottles_to_collect ?? 0
      ),
    },
    delivery_address: order.shipping_address ?? null,
  }
}
