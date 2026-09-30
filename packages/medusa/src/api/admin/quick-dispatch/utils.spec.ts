import {
  buildQuickDispatchOrder,
  DispatchOrder,
  isQuickDispatchOrder,
} from "./utils"

describe("quick dispatch order summaries", () => {
  const order: DispatchOrder = {
    id: "order_123",
    display_id: 123,
    status: "pending",
    sales_channel_id: "sc_hub",
    created_at: "2026-09-30T12:00:00.000Z",
    metadata: {
      quick_dispatch_status: "pending_preparation",
      returnable_packaging_summary: {
        empty_bottles_to_collect: 2,
      },
    },
    items: [
      {
        id: "item_cold",
        title: "Cold beverage",
        quantity: 3,
        variant: { product: { metadata: { serves_cold: true } } },
      },
      {
        id: "item_deposit",
        title: "Returnable bottle deposit",
        quantity: 3,
        metadata: {
          returnable_packaging_deposit: true,
          bottle_count: 3,
        },
      },
      {
        id: "item_forged_marker",
        variant_id: "variant_1",
        title: "Regular drink",
        quantity: 1,
        metadata: {
          returnable_packaging_deposit: true,
          bottle_count: 1000,
        },
      },
    ],
    shipping_address: {
      address_1: "Main street 1",
      city: "Example",
    },
  }

  it("builds cold-item, bottle and delivery-address summaries", () => {
    expect(buildQuickDispatchOrder(order)).toMatchObject({
      cold_items: [{ id: "item_cold", title: "Cold beverage", quantity: 3 }],
      bottle_summary: {
        bottles_to_charge: 3,
        empty_bottles_to_collect: 2,
      },
      delivery_address: {
        address_1: "Main street 1",
        city: "Example",
      },
    })
  })

  it("includes pending preparation and requires-action orders, but not ready orders", () => {
    expect(isQuickDispatchOrder(order)).toBe(true)
    expect(isQuickDispatchOrder({ ...order, status: "requires_action" })).toBe(
      true
    )
    expect(
      isQuickDispatchOrder({
        ...order,
        metadata: {
          ...order.metadata,
          quick_dispatch_status: "ready_for_pickup",
        },
      })
    ).toBe(false)
  })
})
