# Store delivery coverage

Configure delivery areas on each Admin **Stock Location** using its `metadata`.
The stock location must also be linked to the **Sales Channel** used for the
local catalog and inventory.

Example radius-based configuration:

```json
{
  "delivery_latitude": 19.4326,
  "delivery_longitude": -99.1332,
  "delivery_radius_km": 8,
  "estimated_delivery_time": "30-45 min"
}
```

Or configure a GeoJSON `Polygon` in longitude/latitude order. Polygon holes are
respected; a location may also specify a center and radius, in which case a
point inside either coverage shape is served.

```json
{
  "delivery_coverage_polygon": {
    "type": "Polygon",
    "coordinates": [
      [
        [-99.2, 19.4],
        [-99.1, 19.4],
        [-99.1, 19.5],
        [-99.2, 19.5],
        [-99.2, 19.4]
      ]
    ]
  },
  "estimated_delivery_time": "20-30 min"
}
```

`POST /store/delivery-coverage` accepts latitude and longitude in decimal
degrees and an optional `cart_id`. When several stock locations cover the
point, the nearest configured center is selected. A successful result includes
both the stock location and its linked sales channel; when `cart_id` is
provided, Medusa's cart update workflow assigns that sales channel to the cart.
When no configured location covers the point, the route returns
`has_coverage: false` and `Aún no llegamos a tu zona.`
