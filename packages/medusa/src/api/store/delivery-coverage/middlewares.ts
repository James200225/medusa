import { validateAndTransformBody } from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import { StoreCheckDeliveryCoverage } from "./validators"

export const storeDeliveryCoverageRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/delivery-coverage",
    middlewares: [validateAndTransformBody(StoreCheckDeliveryCoverage)],
  },
]
