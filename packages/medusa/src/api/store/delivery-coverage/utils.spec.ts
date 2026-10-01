import { findDeliveryCoverage } from "./utils"

describe("findDeliveryCoverage", () => {
  const square = {
    type: "Polygon",
    coordinates: [
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
        [-1, -1],
      ],
    ],
  }

  it("selects the nearest stock location with a linked sales channel", () => {
    const assignment = findDeliveryCoverage(
      [
        {
          id: "far",
          metadata: {
            delivery_latitude: 0,
            delivery_longitude: 0.5,
            delivery_radius_km: 100,
          },
          sales_channels: [{ id: "sc_far" }],
        },
        {
          id: "near",
          metadata: {
            delivery_latitude: 0,
            delivery_longitude: 0.1,
            delivery_radius_km: 20,
            estimated_delivery_time: "20-30 min",
          },
          sales_channels: [{ id: "sc_near" }],
        },
      ],
      { latitude: 0, longitude: 0 }
    )

    expect(assignment).toEqual({
      stock_location_id: "near",
      sales_channel_id: "sc_near",
      estimated_delivery_time: "20-30 min",
      distance_km: expect.any(Number),
    })
  })

  it("uses GeoJSON polygon coverage including its boundary", () => {
    const assignment = findDeliveryCoverage(
      [
        {
          id: "polygon",
          metadata: { delivery_coverage_polygon: square },
          sales_channels: [{ id: "sc_polygon" }],
        },
      ],
      { latitude: 0, longitude: 1 }
    )

    expect(assignment?.stock_location_id).toBe("polygon")
    expect(assignment?.estimated_delivery_time).toBe("30-45 min")
  })

  it("excludes points inside polygon holes", () => {
    const assignment = findDeliveryCoverage(
      [
        {
          id: "polygon-with-hole",
          metadata: {
            delivery_coverage_polygon: {
              ...square,
              coordinates: [
                square.coordinates[0],
                [
                  [-0.25, -0.25],
                  [0.25, -0.25],
                  [0.25, 0.25],
                  [-0.25, 0.25],
                  [-0.25, -0.25],
                ],
              ],
            },
          },
          sales_channels: [{ id: "sc_hole" }],
        },
      ],
      { latitude: 0, longitude: 0 }
    )

    expect(assignment).toBeUndefined()
  })

  it("returns no coverage when the location has no linked sales channel", () => {
    const assignment = findDeliveryCoverage(
      [
        {
          id: "unlinked",
          metadata: {
            delivery_latitude: 0,
            delivery_longitude: 0,
            delivery_radius_km: 10,
          },
        },
      ],
      { latitude: 0, longitude: 0 }
    )

    expect(assignment).toBeUndefined()
  })

  it("returns no coverage outside the configured radius", () => {
    const assignment = findDeliveryCoverage(
      [
        {
          id: "small-radius",
          metadata: {
            delivery_latitude: 0,
            delivery_longitude: 0,
            delivery_radius_km: 1,
          },
          sales_channels: [{ id: "sc_small" }],
        },
      ],
      { latitude: 0, longitude: 1 }
    )

    expect(assignment).toBeUndefined()
  })
})
