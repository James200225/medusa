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

WhatsApp checkout collects the recipient's full name and contact phone, an optional delivery reference, and a payment method. Cash checkout offers quick payment amounts, calculates change, and prevents confirmation when the entered amount is below the order total. The WhatsApp message includes the item subtotal, bottle deposits, empty returnable bottles to collect, cold-item indications, delivery address and Google Maps link, payment details, shipping amount, and amount to collect. If no shipping method has been selected, the message labels delivery as pending confirmation. Since `NEXT_PUBLIC_WHATSAPP_PHONE` is inlined during the production build, configure it before running `npm run build`.

## Install as a PWA

The App Router manifest is available at `/manifest.webmanifest`; install icons are in `public/`. On supported Android browsers, the mobile install banner opens the native install prompt. On iPhone and iPad, tap **Instalar**, then use Share → **Agregar a la pantalla de inicio**. Production installs require HTTPS; localhost is supported for development. The app does not currently cache pages for offline use.

## Responsible delivery

Visitors must confirm they are at least 18 before interacting with the storefront. The confirmation is stored in a first-party cookie and local storage. Delivery runs Wednesday through Sunday, 17:00–02:00 in `America/Guayaquil`; the header shows the current status, and WhatsApp checkout remains disabled outside delivery hours. Customers are reminded that the courier will request their original physical ID at delivery.
