const EARTH_RADIUS_KM = 6371

export type DeliveryCoordinates = {
  latitude: number
  longitude: number
}

type GeoJsonPolygon = {
  type: "Polygon"
  coordinates: number[][][]
}

export type DeliveryCoverageLocation = {
  id: string
  name?: string
  metadata?: Record<string, unknown> | null
  sales_channels?: Array<{ id: string }>
}

export type DeliveryCoverageAssignment = {
  stock_location_id: string
  sales_channel_id: string
  estimated_delivery_time: string
  distance_km: number
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  )
}

function isGeoJsonPolygon(value: unknown): value is GeoJsonPolygon {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    value.type !== "Polygon" ||
    !("coordinates" in value) ||
    !Array.isArray(value.coordinates) ||
    value.coordinates.length === 0
  ) {
    return false
  }

  return value.coordinates.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.length >= 4 &&
      ring.every(isCoordinatePair) &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
  )
}

function isPointInRing(point: DeliveryCoordinates, ring: number[][]): boolean {
  const x = point.longitude
  const y = point.latitude
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crossProduct = (x - xi) * (yj - yi) - (y - yi) * (xj - xi)
    if (
      Math.abs(crossProduct) < 1e-10 &&
      x >= Math.min(xi, xj) &&
      x <= Math.max(xi, xj) &&
      y >= Math.min(yi, yj) &&
      y <= Math.max(yi, yj)
    ) {
      return true
    }

    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

function isPointInPolygon(
  point: DeliveryCoordinates,
  polygon: GeoJsonPolygon
): boolean {
  const [outerRing, ...holes] = polygon.coordinates

  return (
    isPointInRing(point, outerRing) &&
    !holes.some((hole) => isPointInRing(point, hole))
  )
}

function calculateDistanceKm(
  from: DeliveryCoordinates,
  to: DeliveryCoordinates
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDifference = toRadians(to.latitude - from.latitude)
  const longitudeDifference = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const haversine = Math.min(
    1,
    Math.sin(latitudeDifference / 2) ** 2 +
      Math.cos(fromLatitude) *
        Math.cos(toLatitude) *
        Math.sin(longitudeDifference / 2) ** 2
  )

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  )
}

function getLocationCoverage(
  location: DeliveryCoverageLocation,
  customer: DeliveryCoordinates
): DeliveryCoverageAssignment | undefined {
  const metadata = location.metadata
  const channels = location.sales_channels
  const salesChannelId = channels?.map(({ id }) => id).sort()[0]

  if (!metadata || !salesChannelId) {
    return
  }

  const latitude = metadata.delivery_latitude
  const longitude = metadata.delivery_longitude
  const center =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
      ? { latitude, longitude }
      : undefined
  const radius = metadata.delivery_radius_km
  const radiusKm =
    typeof radius === "number" && Number.isFinite(radius) && radius >= 0
      ? radius
      : undefined
  const polygon = metadata.delivery_coverage_polygon
  const coveragePolygon = isGeoJsonPolygon(polygon) ? polygon : undefined

  if (!(coveragePolygon || (center && radiusKm !== undefined))) {
    return
  }

  const distance = center ? calculateDistanceKm(customer, center) : 0

  if (
    !(coveragePolygon && isPointInPolygon(customer, coveragePolygon)) &&
    !(center && radiusKm !== undefined && distance <= radiusKm)
  ) {
    return
  }

  return {
    stock_location_id: location.id,
    sales_channel_id: salesChannelId,
    estimated_delivery_time:
      typeof metadata.estimated_delivery_time === "string" &&
      metadata.estimated_delivery_time.trim()
        ? metadata.estimated_delivery_time.trim()
        : "30-45 min",
    distance_km: distance,
  }
}

export function findDeliveryCoverage(
  locations: DeliveryCoverageLocation[],
  customer: DeliveryCoordinates
): DeliveryCoverageAssignment | undefined {
  return locations
    .map((location) => getLocationCoverage(location, customer))
    .filter(
      (assignment): assignment is DeliveryCoverageAssignment =>
        assignment !== undefined
    )
    .sort(
      (first, second) =>
        first.distance_km - second.distance_km ||
        first.stock_location_id.localeCompare(second.stock_location_id)
    )[0]
}
