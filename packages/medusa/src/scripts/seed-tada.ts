import {
  createInventoryItemsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  deleteProductsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductsWorkflow,
  updateRegionsWorkflow,
  updateStockLocationsWorkflow,
  updateTaxRegionsWorkflow,
} from "@medusajs/core-flows"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import type {
  ExecArgs,
  IProductModuleService,
  IStoreModuleService,
} from "@medusajs/framework/types"

const CURRENCY_CODE = "usd"
const DEFAULT_SALES_CHANNEL_NAME = "Default Sales Channel"
const DEFAULT_STOCK_LOCATION_NAME = "Tada Quito Dark Store"
const DEFAULT_SHIPPING_PROFILE_NAME = "Tada Delivery"
const REGION_NAME = "Ecuador"
const CATEGORY_NAMES = [
  "Cervezas",
  "Retornables",
  "Licores",
  "Bebidas + Snacks",
  "Hielo y Complementos",
]
const DEPOSIT_PRICE = 0.25

const SAMPLE_IMAGES = {
  pilsener:
    "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=1200&q=85",
  club: "https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?auto=format&fit=crop&w=1200&q=85",
  corona:
    "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=1200&q=85",
  whisky:
    "https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1200&q=85",
  ron: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=85",
  ice: "https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=1200&q=85",
  snacks:
    "https://images.unsplash.com/photo-1621939514649-280e2aa2f5a0?auto=format&fit=crop&w=1200&q=85",
}

const SEED_PRODUCTS = [
  {
    title: "Pilsener 330ml",
    handle: "tada-pilsener-330ml",
    categoryNames: ["Cervezas", "Retornables"],
    price: 1.25,
    sku: "TADA-PILSENER-330",
    image: SAMPLE_IMAGES.pilsener,
    metadata: {
      is_returnable: true,
      bottle_deposit_price: DEPOSIT_PRICE,
      serves_cold: true,
      tada_seed: true,
    },
    stock: 240,
  },
  {
    title: "Club Premium 330ml",
    handle: "tada-club-premium-330ml",
    categoryNames: ["Cervezas", "Retornables"],
    price: 1.5,
    sku: "TADA-CLUB-PREMIUM-330",
    image: SAMPLE_IMAGES.club,
    metadata: {
      is_returnable: true,
      bottle_deposit_price: DEPOSIT_PRICE,
      serves_cold: true,
      tada_seed: true,
    },
    stock: 180,
  },
  {
    title: "Corona Six-pack 355ml",
    handle: "tada-corona-six-pack-355ml",
    categoryNames: ["Cervezas"],
    price: 10.99,
    sku: "TADA-CORONA-SIX-355",
    image: SAMPLE_IMAGES.corona,
    metadata: {
      is_returnable: false,
      serves_cold: true,
      tada_seed: true,
    },
    stock: 90,
  },
  {
    title: "Whisky Reserva 750ml",
    handle: "tada-whisky-reserva-750ml",
    categoryNames: ["Licores"],
    price: 24.99,
    sku: "TADA-WHISKY-RESERVA-750",
    image: SAMPLE_IMAGES.whisky,
    metadata: { is_returnable: false, serves_cold: false, tada_seed: true },
    stock: 36,
  },
  {
    title: "Ron Añejo 750ml",
    handle: "tada-ron-anejo-750ml",
    categoryNames: ["Licores"],
    price: 16.99,
    sku: "TADA-RON-ANEJO-750",
    image: SAMPLE_IMAGES.ron,
    metadata: { is_returnable: false, serves_cold: false, tada_seed: true },
    stock: 48,
  },
  {
    title: "Bolsa de Hielo 3kg",
    handle: "tada-bolsa-hielo-3kg",
    categoryNames: ["Hielo y Complementos"],
    price: 2.5,
    sku: "TADA-HIELO-3KG",
    image: SAMPLE_IMAGES.ice,
    metadata: {
      is_returnable: false,
      serves_cold: true,
      tada_seed: true,
    },
    stock: 100,
  },
  {
    title: "Papas Crocantes 150g",
    handle: "tada-papas-crocantes-150g",
    categoryNames: ["Bebidas + Snacks"],
    price: 1.75,
    sku: "TADA-PAPAS-150",
    image: SAMPLE_IMAGES.snacks,
    metadata: { is_returnable: false, serves_cold: false, tada_seed: true },
    stock: 72,
  },
  {
    title: "Maní Salado 100g",
    handle: "tada-mani-salado-100g",
    categoryNames: ["Bebidas + Snacks"],
    price: 1.25,
    sku: "TADA-MANI-100",
    image: SAMPLE_IMAGES.snacks,
    metadata: { is_returnable: false, serves_cold: false, tada_seed: true },
    stock: 72,
  },
] as const

const CLOTHING_TERMS =
  /\b(clothing|apparel|shirt|shirts|overshirt|tee|tees|shorts|pants|trousers|jeans|hoodie|sweatshirt|sweatpants|sweater|jacket|dress|joggers?|beanie|cap|tote|ropa|camiseta|camisetas|pantal[oó]n|pantalones|chaqueta|vestido|linen)\b/i

export default async function seedTada({ container, args }: ExecArgs) {
  const replaceOldClothing =
    args.includes("--delete-old-clothing") ||
    args.includes("delete-old-clothing")
  if (process.env.NODE_ENV === "production" && replaceOldClothing) {
    throw new Error(
      "Refusing to delete demo clothing products when NODE_ENV=production."
    )
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const configuredVat = Number(process.env.TADA_ECUADOR_VAT_RATE ?? "15")

  if (
    !Number.isFinite(configuredVat) ||
    configuredVat < 0 ||
    configuredVat > 100
  ) {
    throw new Error("TADA_ECUADOR_VAT_RATE must be a percentage from 0 to 100.")
  }

  logger.info(
    "Preparing Ecuador USD region, sales channel, and stock location."
  )

  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const salesChannels = await salesChannelModule.listSalesChannels(
    {},
    { take: 100 }
  )
  let salesChannel =
    salesChannels.find(
      (channel) => channel.name === DEFAULT_SALES_CHANNEL_NAME
    ) ?? salesChannels.find((channel) => !channel.is_disabled)

  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [{ name: DEFAULT_SALES_CHANNEL_NAME }],
      },
    })
    salesChannel = result[0]
  }

  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const stockLocations = await stockLocationModule.listStockLocations(
    {},
    { take: 100 }
  )
  let stockLocation =
    stockLocations.find(
      (location) => location.name === DEFAULT_STOCK_LOCATION_NAME
    ) ?? stockLocations[0]

  if (!stockLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: DEFAULT_STOCK_LOCATION_NAME,
            address: {
              address_1: "Av. República del Salvador",
              city: "Quito",
              country_code: "ec",
              province: "pichincha",
            },
            metadata: {
              is_default: true,
              latitude: -0.1807,
              longitude: -78.4678,
            },
          },
        ],
      },
    })
    stockLocation = result[0]
  }

  await updateStockLocationsWorkflow(container).run({
    input: {
      selector: { id: stockLocation.id },
      update: {
        metadata: {
          ...(stockLocation.metadata ?? {}),
          is_default: true,
          latitude: -0.1807,
          longitude: -78.4678,
          delivery_latitude: -0.1807,
          delivery_longitude: -78.4678,
          delivery_radius_km: 30,
          estimated_delivery_time: "30-45 min",
        },
      },
    },
  })

  const stockLocationQuery = await query.graph({
    entity: "stock_location",
    fields: ["id", "sales_channels.id"],
    filters: { id: stockLocation.id },
  })
  const linkedSalesChannelIds = (
    stockLocationQuery.data[0]?.sales_channels ?? []
  ).map((channel: { id: string }) => channel.id)

  if (!linkedSalesChannelIds.includes(salesChannel.id)) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
  }

  const storeModule = container.resolve<IStoreModuleService>(Modules.STORE)
  const [store] = await storeModule.listStores({}, { take: 1 })
  const supportedCurrencies = [
    ...(store?.supported_currencies ?? [])
      .filter((currency) => currency.currency_code !== CURRENCY_CODE)
      .map((currency) => ({
        currency_code: currency.currency_code,
        is_default: false,
      })),
    { currency_code: CURRENCY_CODE, is_default: true },
  ]

  const regionQuery = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
    pagination: { take: 100 },
  })
  const ecuadorRegion = regionQuery.data.find(
    (region: { countries?: { iso_2: string }[] }) =>
      region.countries?.some((country) => country.iso_2 === "ec")
  )

  let regionId: string
  if (ecuadorRegion) {
    const { result } = await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: ecuadorRegion.id },
        update: {
          name: REGION_NAME,
          currency_code: CURRENCY_CODE,
          countries: ["ec"],
          automatic_taxes: true,
          is_tax_inclusive: true,
        },
      },
    })
    regionId = result[0].id
  } else {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: CURRENCY_CODE,
            countries: ["ec"],
            automatic_taxes: true,
            is_tax_inclusive: true,
          },
        ],
      },
    })
    regionId = result[0].id
  }

  if (store) {
    await storeModule.updateStores(store.id, {
      supported_currencies: supportedCurrencies,
      default_sales_channel_id: salesChannel.id,
      default_region_id: regionId,
      default_location_id: stockLocation.id,
    })
  } else {
    await storeModule.createStores({
      name: "Tada Delivery Ecuador",
      supported_currencies: supportedCurrencies,
      default_sales_channel_id: salesChannel.id,
      default_region_id: regionId,
      default_location_id: stockLocation.id,
    })
  }

  const taxRegionQuery = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code", "provider_id"],
    filters: { country_code: "ec" },
    pagination: { take: 10 },
  })

  if (!taxRegionQuery.data.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "ec",
          provider_id: "tp_system",
          default_tax_rate: {
            name: "IVA Ecuador",
            code: "IVA-EC",
            rate: configuredVat,
            metadata: { seeded_by: "tada-delivery" },
          },
          metadata: { seeded_by: "tada-delivery" },
        },
      ],
    })
    logger.info(`Created Ecuador VAT tax region at ${configuredVat}%.`)
  } else {
    const unassignedRegions = taxRegionQuery.data.filter(
      (taxRegion: { id: string; provider_id?: string | null }) =>
        !taxRegion.provider_id
    )
    if (unassignedRegions.length) {
      await updateTaxRegionsWorkflow(container).run({
        input: unassignedRegions.map((taxRegion: { id: string }) => ({
          id: taxRegion.id,
          provider_id: "tp_system",
        })),
      })
      logger.info("Assigned the system tax provider to Ecuador tax regions.")
    }
    logger.info(
      "An Ecuador tax region already exists; preserving its configured tax rates."
    )
  }

  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const shippingProfiles = await fulfillmentModule.listShippingProfiles(
    {},
    { take: 100 }
  )
  let shippingProfile =
    shippingProfiles.find(
      (profile) => profile.name === DEFAULT_SHIPPING_PROFILE_NAME
    ) ?? shippingProfiles.find((profile) => profile.type === "default")

  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: DEFAULT_SHIPPING_PROFILE_NAME, type: "default" }],
      },
    })
    shippingProfile = result[0]
  }

  const categoryQuery = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
    pagination: { take: 100 },
  })
  const existingCategories = new Map(
    categoryQuery.data.map((category: { id: string; name: string }) => [
      category.name.toLowerCase(),
      category.id,
    ])
  )
  const missingCategories = CATEGORY_NAMES.filter(
    (name) => !existingCategories.has(name.toLowerCase())
  )

  if (missingCategories.length) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingCategories.map((name) => ({
          name,
          is_active: true,
        })),
      },
    })
    for (const category of result) {
      existingCategories.set(category.name.toLowerCase(), category.id)
    }
  }

  const categories = Object.fromEntries(existingCategories)
  const productModule = container.resolve<IProductModuleService>(
    Modules.PRODUCT
  )
  const currentProducts = await productModule.listProducts({}, { take: 1000 })
  const productsByHandle = new Map(
    currentProducts.map((product) => [product.handle, product])
  )
  const newProducts = SEED_PRODUCTS.filter(
    (product) => !productsByHandle.has(product.handle)
  )

  if (newProducts.length) {
    const { result: inventoryItems } = await createInventoryItemsWorkflow(
      container
    ).run({
      input: {
        items: newProducts.map((product) => ({
          sku: product.sku,
          title: product.title,
          requires_shipping: true,
          location_levels: [
            {
              location_id: stockLocation.id,
              stocked_quantity: product.stock,
            },
          ],
        })),
      },
    })

    const productInputs = newProducts.map((product, index) => ({
      title: product.title,
      handle: product.handle,
      description: `${product.title} para entrega local en Ecuador.`,
      status: ProductStatus.PUBLISHED,
      discountable: true,
      thumbnail: product.image,
      images: [{ url: product.image }],
      category_ids: product.categoryNames.map(
        (name) => categories[name.toLowerCase()] as string
      ),
      metadata: product.metadata,
      sales_channels: [{ id: salesChannel.id }],
      shipping_profile_id: shippingProfile.id,
      options: [{ title: "Presentación", values: [product.title] }],
      variants: [
        {
          title: product.title,
          sku: product.sku,
          manage_inventory: true,
          options: { Presentación: product.title },
          inventory_items: [
            {
              inventory_item_id: inventoryItems[index].id,
              required_quantity: 1,
            },
          ],
          prices: [{ currency_code: CURRENCY_CODE, amount: product.price }],
        },
      ],
    }))

    const { result } = await createProductsWorkflow(container).run({
      input: { products: productInputs },
    })

    for (const product of result) {
      productsByHandle.set(product.handle, product)
    }
    logger.info(`Created ${result.length} Tada beverage and snack products.`)
  }

  const seededProducts = SEED_PRODUCTS.map((product) => {
    const existingProduct = productsByHandle.get(product.handle)
    const categoryIds = product.categoryNames.map(
      (name) => categories[name.toLowerCase()] as string
    )

    if (!existingProduct) {
      throw new Error(`Expected seeded product ${product.handle} to exist.`)
    }

    return { definition: product, existing: existingProduct, categoryIds }
  })

  for (const product of seededProducts) {
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: product.existing.id },
        update: {
          metadata: product.definition.metadata,
          category_ids: product.categoryIds,
          sales_channels: [{ id: salesChannel.id }],
        },
      },
    })
  }

  if (replaceOldClothing) {
    const clothingQuery = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "type.value", "categories.name"],
      pagination: { take: 1000 },
    })
    const oldClothingIds = clothingQuery.data
      .filter(
        (product: {
          handle?: string
          title?: string
          type?: { value?: string } | null
          categories?: { name: string }[]
        }) => {
          const isDemoProduct =
            product.handle?.startsWith("demo-") ??
            product.title?.startsWith("Medusa ") ??
            false
          const isStarterCatalogProduct =
            product.title?.startsWith("Medusa ") ?? false
          const descriptiveText = [
            product.title,
            product.handle,
            product.type?.value,
            ...(product.categories ?? []).map((category) => category.name),
          ]
            .filter(Boolean)
            .join(" ")

          return (
            CLOTHING_TERMS.test(descriptiveText) &&
            (isDemoProduct || isStarterCatalogProduct)
          )
        }
      )
      .map((product: { id: string }) => product.id)

    if (oldClothingIds.length) {
      await deleteProductsWorkflow(container).run({
        input: { ids: oldClothingIds },
      })
      logger.info(`Removed ${oldClothingIds.length} demo clothing product(s).`)
    } else {
      logger.info(
        "No old demo clothing products matched the safe deletion filter."
      )
    }
  } else {
    logger.info(
      "Existing demo clothing was preserved. Pass --delete-old-clothing to remove matching demo apparel."
    )
  }

  logger.info(
    `Tada seed complete: ${seededProducts.length} catalog products, region ${regionId}, sales channel ${salesChannel.id}, stock location ${stockLocation.id}.`
  )
}
