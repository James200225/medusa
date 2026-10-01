import { expect, test } from "@playwright/test"
import type { Page, Route } from "@playwright/test"

const PILSENER = {
  id: "prod_tada_pilsener",
  title: "Pilsener 330ml",
  handle: "tada-pilsener-330ml",
  thumbnail: "https://images.unsplash.com/photo-1608270586620-248524c67de9",
  metadata: {
    is_returnable: true,
    bottle_deposit_price: 0.25,
    serves_cold: true,
  },
  categories: [{ id: "cat_beer", name: "Cervezas", handle: "cervezas" }],
  variants: [
    {
      id: "variant_tada_pilsener",
      title: "Pilsener 330ml",
      inventory_quantity: 20,
      manage_inventory: true,
      calculated_price: {
        calculated_amount: 1.25,
        currency_code: "usd",
      },
    },
  ],
}
const BOTTLE_DEPOSIT = PILSENER.metadata.bottle_deposit_price

type CartItem = {
  id: string
  product_id: string
  product_title: string
  variant_id: string
  title: string
  quantity: number
  unit_price: number
  thumbnail: string
  metadata: Record<string, unknown>
}

type MockCart = {
  id: string
  currency_code: string
  region_id: string
  sales_channel_id: string | null
  total: number
  subtotal: number
  shipping_total: number
  items: CartItem[]
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

async function mockCheckoutStoreApi(page: Page) {
  const cart: MockCart = {
    id: "cart_checkout_e2e",
    currency_code: "usd",
    region_id: "reg_ecuador_e2e",
    sales_channel_id: null,
    total: 0,
    subtotal: 0,
    shipping_total: 0,
    items: [],
  }
  const coverageRequests: { latitude: number; longitude: number }[] = []
  const lineItemUpdates: Record<string, unknown>[] = []

  await page.route("**/api/medusa/**", async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())

    if (pathname.endsWith("/store/regions")) {
      await fulfillJson(route, {
        regions: [
          {
            id: cart.region_id,
            name: "Ecuador",
            currency_code: "usd",
            countries: [{ iso_2: "ec" }],
          },
        ],
      })
      return
    }

    if (pathname.endsWith("/store/products")) {
      await fulfillJson(route, { products: [PILSENER] })
      return
    }

    if (pathname.endsWith("/store/delivery-coverage")) {
      const body = request.postDataJSON() as {
        latitude: number
        longitude: number
      }
      coverageRequests.push(body)
      cart.sales_channel_id = "sc_quito_e2e"
      await fulfillJson(route, {
        has_coverage: true,
        sales_channel_id: cart.sales_channel_id,
        estimated_delivery_time: "30-45 min",
      })
      return
    }

    if (pathname.endsWith("/store/carts") && request.method() === "POST") {
      await fulfillJson(route, { cart })
      return
    }

    if (
      pathname.includes("/store/carts/") &&
      pathname.endsWith("/line-items")
    ) {
      const body = request.postDataJSON() as {
        quantity: number
        metadata?: Record<string, unknown>
      }
      const line: CartItem = {
        id: "item_pilsener_e2e",
        product_id: PILSENER.id,
        product_title: PILSENER.title,
        variant_id: PILSENER.variants[0].id,
        title: PILSENER.title,
        quantity: body.quantity,
        unit_price: 1.25,
        thumbnail: PILSENER.thumbnail,
        metadata: body.metadata ?? {},
      }
      cart.items = [line]
      cart.subtotal = line.unit_price * line.quantity
      if (line.metadata.returns_bottle !== true) {
        cart.items.push({
          id: "item_deposit_e2e",
          product_id: PILSENER.id,
          product_title: "Depósito de envase retornable",
          variant_id: "variant_deposit_e2e",
          title: "Depósito de envase retornable",
          quantity: line.quantity,
          unit_price: BOTTLE_DEPOSIT,
          thumbnail: "",
          metadata: { returnable_packaging_deposit: true },
        })
      }
      cart.total = cart.items.reduce(
        (total, item) => total + item.unit_price * item.quantity,
        cart.shipping_total
      )
      await fulfillJson(route, { cart })
      return
    }

    if (
      pathname.includes("/store/carts/") &&
      pathname.includes("/line-items/")
    ) {
      const body = request.postDataJSON() as {
        quantity: number
        metadata?: Record<string, unknown>
      }
      lineItemUpdates.push(body.metadata ?? {})
      const line = cart.items.find((item) => item.id === "item_pilsener_e2e")

      if (line) {
        line.quantity = body.quantity
        line.metadata = body.metadata ?? line.metadata
      }

      if (line?.metadata.returns_bottle === true) {
        cart.items = cart.items.filter(
          (item) => item.metadata.returnable_packaging_deposit !== true
        )
      } else if (
        line &&
        !cart.items.some(
          (item) => item.metadata.returnable_packaging_deposit === true
        )
      ) {
        cart.items.push({
          id: "item_deposit_e2e",
          product_id: PILSENER.id,
          product_title: "Depósito de envase retornable",
          variant_id: "variant_deposit_e2e",
          title: "Depósito de envase retornable",
          quantity: line.quantity,
          unit_price: BOTTLE_DEPOSIT,
          thumbnail: "",
          metadata: { returnable_packaging_deposit: true },
        })
      }

      cart.subtotal = line ? line.unit_price * line.quantity : 0
      cart.total = cart.items.reduce(
        (total, item) => total + item.unit_price * item.quantity,
        cart.shipping_total
      )
      await fulfillJson(route, { cart })
      return
    }

    if (pathname.includes("/store/carts/")) {
      await fulfillJson(route, { cart })
      return
    }

    await route.continue()
  })

  return { cart, coverageRequests, lineItemUpdates }
}

test("age gate stores the adult verification for the session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("tada_age_verified")
    document.cookie = "tada_age_verified=; Max-Age=0; Path=/"
  })
  await mockCheckoutStoreApi(page)
  await page.goto("/")

  const ageDialog = page.getByRole("alertdialog")
  await expect(ageDialog).toBeVisible()
  await expect(
    ageDialog.getByRole("heading", { name: "¿Tienes más de 18 años?" })
  ).toBeVisible()

  await ageDialog.getByRole("button", { name: "Soy mayor de 18" }).click()

  await expect(ageDialog).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("tada_age_verified"))
    )
    .toBe("true")
  await expect
    .poll(() => page.evaluate(() => document.cookie))
    .toContain("tada_age_verified=1")
})

test("customer checks coverage, removes the bottle deposit, and prepares WhatsApp checkout", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-01T23:00:00.000Z") })
  await page.addInitScript(() => {
    window.localStorage.setItem("tada_age_verified", "true")
    document.cookie = "tada_age_verified=1; Path=/; SameSite=Lax"
    window.localStorage.removeItem("tada-medusa-cart")
    window.localStorage.removeItem("tada-delivery-location")
  })
  const { cart, coverageRequests, lineItemUpdates } =
    await mockCheckoutStoreApi(page)

  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "¿Qué vas a pedir hoy?" })
  ).toBeVisible()

  await page
    .getByRole("button", { name: "Elegir dirección de entrega" })
    .click()
  await page.getByRole("button", { name: /La Carolina/ }).click()
  await expect(
    page.getByText(/La Carolina \/ Centro Norte, Quito/)
  ).toBeVisible()
  expect(coverageRequests).toContainEqual(
    expect.objectContaining({
      latitude: -0.1807,
      longitude: -78.4678,
    })
  )

  const pilsenerCard = page
    .locator(".product-card")
    .filter({ hasText: "Pilsener 330ml" })
  await pilsenerCard.getByRole("button", { name: /Añadir/ }).click()

  const drawer = page.getByRole("dialog", { name: "Mi pedido" })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText("Subtotal bebidas")).toBeVisible()
  await expect(
    drawer.locator(".cart-summary").getByText(/\$1[,.]25/)
  ).toBeVisible()
  await expect(drawer.getByText("Depósito de envase retornable")).toBeVisible()
  await expect(
    drawer.locator(".cart-summary").getByText(/\$0[,.]25/)
  ).toBeVisible()

  await drawer
    .getByRole("group", { name: "¿Tienes envase para Pilsener 330ml?" })
    .getByRole("button", { name: "Sí tengo envase" })
    .click()
  await expect(drawer.getByText("Depósito de envase retornable")).toHaveCount(0)
  await expect(
    drawer.locator(".cart-summary").getByText(/\$0[,.]00/)
  ).toBeVisible()
  await expect(lineItemUpdates).toContainEqual(
    expect.objectContaining({ returns_bottle: true })
  )

  await drawer.getByRole("radio", { name: /Efectivo al recibir/ }).check()
  await drawer.getByPlaceholder("Nombre completo").fill("Cliente E2E")
  await drawer.getByPlaceholder("09 1234 5678").fill("0991234567")
  await drawer.getByRole("button", { name: "$20" }).click()
  await expect(drawer.getByText(/Cambio a devolver:/)).toBeVisible()

  const whatsappButton = drawer.getByRole("button", {
    name: "Confirmar pedido por WhatsApp",
  })
  await expect(whatsappButton).toBeEnabled()
  expect(cart.items).toHaveLength(1)
})
