import { StoreCheckDeliveryCoverage } from "./validators"

describe("StoreCheckDeliveryCoverage", () => {
  it("accepts valid coordinates and an optional cart id", () => {
    expect(
      StoreCheckDeliveryCoverage.safeParse({
        latitude: 19.4326,
        longitude: -99.1332,
        cart_id: "cart_123",
      }).success
    ).toBe(true)
  })

  it("rejects coordinates outside latitude and longitude ranges", () => {
    expect(
      StoreCheckDeliveryCoverage.safeParse({
        latitude: 91,
        longitude: -99.1332,
      }).success
    ).toBe(false)
    expect(
      StoreCheckDeliveryCoverage.safeParse({
        latitude: 19.4326,
        longitude: 181,
      }).success
    ).toBe(false)
  })

  it("rejects unknown fields", () => {
    expect(
      StoreCheckDeliveryCoverage.safeParse({
        latitude: 19.4326,
        longitude: -99.1332,
        sales_channel_id: "sc_attacker",
      }).success
    ).toBe(false)
  })
})
