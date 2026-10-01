import { expect, test } from "@playwright/test"

test("visitor can verify their age and open the TaDa storefront", async ({
  page,
}) => {
  const cart = {
    id: "cart_e2e",
    currency_code: "usd",
    region_id: "reg_e2e",
    sales_channel_id: null,
    total: 0,
    subtotal: 0,
    shipping_total: 0,
    items: [],
  }

  await page.route("**/api/medusa/**", async (route) => {
    const { pathname } = new URL(route.request().url())
    let body: unknown

    if (pathname.endsWith("/store/regions")) {
      body = {
        regions: [
          {
            id: "reg_e2e",
            name: "Ecuador",
            currency_code: "usd",
            countries: [{ iso_2: "ec" }],
          },
        ],
      }
    } else if (pathname.endsWith("/store/products")) {
      body = { products: [] }
    } else if (pathname.endsWith("/store/carts")) {
      body = { cart }
    } else if (pathname.includes("/store/carts/")) {
      body = { cart }
    } else {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  })

  await page.goto("/")

  const ageDialog = page.getByRole("alertdialog")
  await expect(ageDialog).toBeVisible()
  await expect(
    ageDialog.getByRole("heading", { name: "¿Tienes más de 18 años?" })
  ).toBeVisible()
  await ageDialog.getByRole("button", { name: "Soy mayor de 18" }).click()

  await expect(
    page.getByRole("heading", { name: "¿Qué vas a pedir hoy?" })
  ).toBeVisible()
  await expect(page).toHaveTitle(/TaDa Delivery/)
})
