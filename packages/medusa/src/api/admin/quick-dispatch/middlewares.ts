import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import { PolicyOperation } from "@medusajs/framework/utils"
import {
  AdminQuickDispatchOrderReady,
  AdminQuickDispatchOrdersQuery,
} from "./validators"

export const adminQuickDispatchRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/quick-dispatch/orders",
    middlewares: [
      validateAndTransformQuery(AdminQuickDispatchOrdersQuery, {
        defaults: [],
        isList: true,
      }),
    ],
    policies: [
      {
        resource: "order",
        operation: PolicyOperation.read,
      },
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/quick-dispatch/orders/:id/ready",
    middlewares: [validateAndTransformBody(AdminQuickDispatchOrderReady)],
    policies: [
      {
        resource: "order",
        operation: PolicyOperation.update,
      },
    ],
  },
]
