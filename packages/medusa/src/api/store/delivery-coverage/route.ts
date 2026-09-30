import { updateCartWorkflow } from "@medusajs/core-flows"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils"
import { StoreCheckDeliveryCoverageType } from "./validators"
import { DeliveryCoverageLocation, findDeliveryCoverage } from "./utils"

const LOCATIONS_PER_PAGE = 100

type DeliveryCoverageResponse = {
  has_coverage: boolean
  stock_location_id?: string
  sales_channel_id?: string
  estimated_delivery_time?: string
  message?: string
}

export const POST = async (
  req: MedusaRequest<StoreCheckDeliveryCoverageType>,
  res: MedusaResponse<DeliveryCoverageResponse>
) => {
  const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const locations: DeliveryCoverageLocation[] = []
  let offset = 0
  let count = 0

  do {
    const { rows, metadata } = await remoteQuery(
      remoteQueryObjectFromString({
        entryPoint: "stock_locations",
        variables: {
          filters: { deleted_at: null },
          take: LOCATIONS_PER_PAGE,
          skip: offset,
        },
        fields: ["id", "name", "metadata", "sales_channels.id"],
      })
    )

    locations.push(...(rows as DeliveryCoverageLocation[]))
    count = metadata.count

    const nextOffset = metadata.skip + metadata.take
    if (nextOffset <= offset) {
      break
    }
    offset = nextOffset
  } while (offset < count)

  const assignment = findDeliveryCoverage(locations, {
    latitude: req.validatedBody.latitude,
    longitude: req.validatedBody.longitude,
  })

  if (!assignment) {
    return res.status(200).json({
      has_coverage: false,
      message: "Aún no llegamos a tu zona.",
    })
  }

  if (req.validatedBody.cart_id) {
    await updateCartWorkflow(req.scope).run({
      input: {
        id: req.validatedBody.cart_id,
        sales_channel_id: assignment.sales_channel_id,
      },
    })
  }

  return res.status(200).json({
    has_coverage: true,
    stock_location_id: assignment.stock_location_id,
    sales_channel_id: assignment.sales_channel_id,
    estimated_delivery_time: assignment.estimated_delivery_time,
  })
}
