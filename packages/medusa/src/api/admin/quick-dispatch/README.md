# Quick dispatch

The authenticated Admin API exposes a hub-scoped packing queue:

- `GET /admin/quick-dispatch/orders?sales_channel_id=<channel-id>`
- `POST /admin/quick-dispatch/orders/:id/ready` with
  `{ "sales_channel_id": "<channel-id>" }`

The queue returns `orders`, `count`, and the requested `sales_channel_id`.
Each order contains its cold items, `bottle_summary` (`bottles_to_charge` and
`empty_bottles_to_collect`), and `delivery_address`.

The queue includes orders in Medusa's `requires_action` state and orders whose
`metadata.quick_dispatch_status` is `pending_preparation`. Medusa's core order
status type does not include a preparation state, so operational states are
stored in order metadata. Marking an order ready sets
`quick_dispatch_status: "ready_for_pickup"` and records the timestamp and Admin
user ID. Ready orders no longer appear in the packing queue.

Mark products or variants that need cold handling with `metadata.is_cold: true`
or `metadata.storage_temperature: "cold"`. The queue also reports the charged
and collection bottle counts from returnable-packaging metadata, plus the
shipping address.

The `order.placed` subscriber initializes preparation metadata and can notify a
hub webhook. Set `QUICK_DISPATCH_WEBHOOK_URL` to the webhook receiver URL. The
JSON payload uses the event name `quick_dispatch.order_placed` and includes the
sales channel ID so the receiver can route the alert to the right hub. Optionally
set `QUICK_DISPATCH_WEBHOOK_SECRET` to sign the raw request body; the signature
is sent in `x-medusa-quick-dispatch-signature` as `sha256=<hex HMAC>`. A webhook
failure is surfaced so Medusa's event-bus retry policy can retry delivery.
