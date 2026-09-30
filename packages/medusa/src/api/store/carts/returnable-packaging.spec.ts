import { MedusaError } from "@medusajs/framework/utils"
import { calculateReturnablePackaging } from "./returnable-packaging"
import { StoreAddCartLineItem } from "./validators"

describe("calculateReturnablePackaging", () => {
  it("calculates deposits and bottle collection from product or variant metadata", () => {
    const result = calculateReturnablePackaging([
      {
        id: "line_product",
        quantity: 2,
        unit_price: 12,
        subtotal: 23,
        metadata: {},
        product: {
          metadata: {
            is_returnable: true,
            bottle_deposit_price: 0.25,
          },
        },
      },
      {
        id: "line_variant",
        quantity: 1,
        unit_price: 20,
        metadata: { returns_bottle: true },
        variant: {
          metadata: { is_returnable: true, bottle_deposit_price: 0.5 },
        },
      },
      {
        id: "line_regular",
        quantity: 1,
        unit_price: 5,
        metadata: {},
      },
    ])

    expect(result).toEqual({
      beverage_subtotal: 48,
      bottle_deposit_total: 0.5,
      empty_bottles_to_collect: 1,
    })
  })

  it("does not double-count the generated deposit line", () => {
    const result = calculateReturnablePackaging([
      {
        id: "line_drink",
        quantity: 2,
        unit_price: 3,
        metadata: {},
        product: {
          metadata: { is_returnable: true, bottle_deposit_price: 0.25 },
        },
      },
      {
        id: "line_deposit",
        quantity: 2,
        unit_price: 0.25,
        metadata: { returnable_packaging_deposit: true },
      },
    ])

    expect(result).toEqual({
      beverage_subtotal: 6,
      bottle_deposit_total: 0.5,
      empty_bottles_to_collect: 0,
    })
  })

  it("does not treat a catalog line with a forged deposit marker as a deposit", () => {
    const result = calculateReturnablePackaging([
      {
        id: "forged_deposit_marker",
        variant_id: "variant_123",
        quantity: 1,
        unit_price: 4,
        metadata: {
          returnable_packaging_deposit: true,
          returns_bottle: false,
        },
        product: {
          metadata: { is_returnable: true, bottle_deposit_price: 0.5 },
        },
      },
    ])

    expect(result).toEqual({
      beverage_subtotal: 4,
      bottle_deposit_total: 0.5,
      empty_bottles_to_collect: 0,
    })
  })

  it("rejects a non-boolean returns_bottle value", () => {
    expect(
      StoreAddCartLineItem.safeParse({
        variant_id: "variant_123",
        quantity: 1,
        metadata: { returns_bottle: "true" },
      }).success
    ).toBe(false)

    expect(() =>
      calculateReturnablePackaging([
        {
          id: "line_returnable",
          quantity: 1,
          unit_price: 3,
          metadata: { returns_bottle: "true" },
          product: {
            metadata: { is_returnable: true, bottle_deposit_price: 0.25 },
          },
        },
      ])
    ).toThrow(MedusaError)
  })

  it("rejects returnable products without a valid server configured deposit", () => {
    expect(() =>
      calculateReturnablePackaging([
        {
          id: "line_returnable",
          quantity: 1,
          unit_price: 3,
          metadata: {},
          product: { metadata: { is_returnable: true } },
        },
      ])
    ).toThrow("bottle_deposit_price válido")
  })
})
