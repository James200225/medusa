import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { AdminQuickDispatchOrdersQueryType } from "../validators"
import {
  buildQuickDispatchOrder,
  DispatchOrder,
  isQuickDispatchOrder,
} from "../utils"

const PAGE_SIZE = 100
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

export const GET = async (
  req: AuthenticatedMedusaRequest<{}, AdminQuickDispatchOrdersQueryType>,
  res: MedusaResponse
) => {
  const salesChannelId = req.validatedQuery.sales_channel_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orders: DispatchOrder[] = []
  let offset = 0
  let count = 0

  do {
    const { data, metadata } = await query.graph({
      entity: "order",
      fields: ORDER_FIELDS,
      filters: {
        sales_channel_id: salesChannelId,
        status: ["pending", "requires_action"],
      },
      pagination: {
        take: PAGE_SIZE,
        skip: offset,
        order: { created_at: "ASC" },
      },
    })

    orders.push(...(data as DispatchOrder[]))
    if (!metadata) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "No se pudo leer la paginación de la cola de preparación."
      )
    }
    count = metadata.count
    const nextOffset = metadata.skip + metadata.take

    if (nextOffset <= offset) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "No se pudo paginar la cola de preparación."
      )
    }
    offset = nextOffset
  } while (offset < count)

  const dispatchOrders = orders
    .filter(isQuickDispatchOrder)
    .map(buildQuickDispatchOrder)

  res.status(200).json({
    orders: dispatchOrders,
    count: dispatchOrders.length,
    sales_channel_id: salesChannelId,
  })
}
