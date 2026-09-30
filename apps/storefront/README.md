# TaDa Delivery storefront

Standalone Next.js storefront for the Medusa backend in this repository.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `MEDUSA_BACKEND_URL` and a publishable API key linked to the intended sales channel.
3. Set `NEXT_PUBLIC_WHATSAPP_PHONE` to the dispatch team's phone number in international format, digits only (for example, `593991234567`). This public value is included in the client bundle; never put credentials or secrets in it.
4. Install dependencies and start Next.js:

   ```sh
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`.

The browser calls the same-origin `/api/medusa/*` proxy. The proxy forwards requests to Medusa with the publishable key, so storefront requests do not depend on the browser's CORS configuration. The backend must still allow its usual local connections and have a USD/Ecuador region and products seeded.

The delivery selector accepts an address and GPS coordinates. Address geocoding is not configured; use the browser location control or enter coordinates from your address source. Coverage is checked through `POST /store/delivery-coverage`.

WhatsApp checkout includes the item subtotal, bottle deposits, the number of empty returnable bottles to collect, the delivery address and coordinates, the shipping amount currently present on the cart, and the cart total. If no shipping method has been selected, the message labels delivery and the total as pending confirmation. Since `NEXT_PUBLIC_WHATSAPP_PHONE` is inlined during the production build, configure it before running `npm run build`.
