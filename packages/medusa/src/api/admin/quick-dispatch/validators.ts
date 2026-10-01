import { z } from "@medusajs/framework/zod"

export const AdminQuickDispatchOrdersQuery = z
  .object({
    sales_channel_id: z.string().min(1),
  })
  .strict()

export const AdminQuickDispatchOrderReady = z
  .object({
    sales_channel_id: z.string().min(1),
  })
  .strict()

export type AdminQuickDispatchOrdersQueryType = z.infer<
  typeof AdminQuickDispatchOrdersQuery
>

export type AdminQuickDispatchOrderReadyType = z.infer<
  typeof AdminQuickDispatchOrderReady
>
