import { z } from "@medusajs/framework/zod"

export const StoreCheckDeliveryCoverage = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    cart_id: z.string().min(1).optional(),
  })
  .strict()

export type StoreCheckDeliveryCoverageType = z.infer<
  typeof StoreCheckDeliveryCoverage
>
