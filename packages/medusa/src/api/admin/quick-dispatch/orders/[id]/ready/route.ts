import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { IOrderModuleService } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { AdminQuickDispatchOrderReadyType } from "../../../validators"
import { QUICK_DISPATCH_STATUS_KEY } from "../../../utils"

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminQuickDispatchOrderReadyType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "status", "sales_channel_id", "metadata"],
    filters: { id: req.params.id },
  })
  const order = data[0]

  if (!order || order.sales_channel_id !== req.validatedBody.sales_channel_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No se encontró el pedido en este punto de despacho."
    )
  }

  if (order.status === "canceled" || order.status === "archived") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "No se puede preparar un pedido cancelado o archivado."
    )
  }

  const dispatchStatus = order.metadata?.[QUICK_DISPATCH_STATUS_KEY]
  if (
    order.status !== "requires_action" &&
    dispatchStatus !== "pending_preparation" &&
    dispatchStatus !== "ready_for_pickup"
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "El pedido no está pendiente de preparación en este punto."
    )
  }

  if (dispatchStatus === "ready_for_pickup") {
    return res.status(200).json({
      order_id: order.id,
      sales_channel_id: order.sales_channel_id,
      quick_dispatch_status: "ready_for_pickup",
      ready_at: order.metadata?.quick_dispatch_ready_at ?? null,
    })
  }

  const readyAt = new Date().toISOString()
  const metadata = {
    ...(order.metadata ?? {}),
    [QUICK_DISPATCH_STATUS_KEY]: "ready_for_pickup",
    quick_dispatch_ready_at: readyAt,
    quick_dispatch_ready_by: req.auth_context.actor_id,
  }
  const orderModule = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  await orderModule.updateOrders(order.id, { metadata })

  return res.status(200).json({
    order_id: order.id,
    sales_channel_id: order.sales_channel_id,
    quick_dispatch_status: "ready_for_pickup",
    ready_at: readyAt,
  })
}
