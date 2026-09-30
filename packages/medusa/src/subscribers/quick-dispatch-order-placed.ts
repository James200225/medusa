import { createHmac } from "node:crypto"
import { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  buildQuickDispatchOrder,
  DispatchOrder,
  QUICK_DISPATCH_STATUS_KEY,
} from "../api/admin/quick-dispatch/utils"
import { SubscriberArgs, SubscriberConfig } from "../types/subscribers"

const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "sales_channel_id",
  "created_at",
  "metadata",
  "items.id",
  "items.product_id",
  "items.variant_id",
  "items.title",
  "items.quantity",
  "items.metadata",
  "items.line_item_metadata",
  "items.variant.metadata",
  "items.variant.product.metadata",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.company",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
  "shipping_address.phone",
]

export default async function quickDispatchOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: event.data.id },
  })
  const order = data[0] as DispatchOrder | undefined

  if (!order) {
    logger.warn(`Quick dispatch skipped: order ${event.data.id} was not found.`)
    return
  }

  if (!order.sales_channel_id) {
    logger.debug(
      `Quick dispatch skipped: order ${order.id} has no sales channel.`
    )
    return
  }

  const dispatchStatus = order.metadata?.[QUICK_DISPATCH_STATUS_KEY]
  if (dispatchStatus === "ready_for_pickup") {
    return
  }
  const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER)
  const metadata = {
    ...(order.metadata ?? {}),
    [QUICK_DISPATCH_STATUS_KEY]: "pending_preparation",
  }
  await orderModule.updateOrders(order.id, { metadata })
  order.metadata = metadata

  const webhookUrl = process.env.QUICK_DISPATCH_WEBHOOK_URL
  if (!webhookUrl) {
    logger.info(
      `Quick dispatch order ${order.id} recorded; set QUICK_DISPATCH_WEBHOOK_URL to notify the hub.`
    )
    return
  }

  const payload = {
    event: "quick_dispatch.order_placed",
    occurred_at: new Date().toISOString(),
    data: buildQuickDispatchOrder(order),
  }
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }
  const signingSecret = process.env.QUICK_DISPATCH_WEBHOOK_SECRET

  if (signingSecret) {
    const signature = createHmac("sha256", signingSecret)
      .update(body)
      .digest("hex")
    headers["x-medusa-quick-dispatch-signature"] = `sha256=${signature}`
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(
      `Quick dispatch webhook returned HTTP ${response.status} for order ${order.id}.`
    )
  }
  await response.body?.cancel()
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "quick-dispatch-order-placed",
  },
}
