import { refreshCartItemsWorkflowId } from "@medusajs/core-flows"
import {
  ICartModuleService,
  MedusaContainer,
  CreateLineItemForCartDTO,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

const DEPOSIT_LINE_METADATA_KEY = "returnable_packaging_deposit"
const PACKAGING_SUMMARY_KEY = "returnable_packaging_summary"

type PackagingItem = {
  id: string
  product_id?: string | null
  variant_id?: string | null
  quantity: number | string
  unit_price: number | string
  subtotal?: number | string
  metadata?: Record<string, unknown> | null
  product?: { metadata?: Record<string, unknown> | null } | null
  variant?: {
    metadata?: Record<string, unknown> | null
    product?: { metadata?: Record<string, unknown> | null } | null
  } | null
}

type PackagingSummary = {
  beverage_subtotal: number
  bottle_deposit_total: number
  empty_bottles_to_collect: number
}

export function calculateReturnablePackaging(
  items: PackagingItem[]
): PackagingSummary {
  return calculatePackaging(items).summary
}

function calculatePackaging(items: PackagingItem[]): {
  summary: PackagingSummary
  depositGroups: Map<number, number>
} {
  let beverageSubtotal = 0
  let bottleDepositTotal = 0
  let emptyBottlesToCollect = 0
  const depositGroups = new Map<number, number>()

  for (const item of items) {
    if (isDepositLine(item)) {
      continue
    }

    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unit_price)
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice)
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `La línea "${item.id}" tiene cantidad o precio inválido.`
      )
    }
    const subtotal =
      item.subtotal === undefined ? quantity * unitPrice : Number(item.subtotal)
    if (!Number.isFinite(subtotal)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `La línea "${item.id}" tiene un subtotal inválido.`
      )
    }
    beverageSubtotal += subtotal

    const returnsBottle = item.metadata?.returns_bottle
    if (returnsBottle !== undefined && typeof returnsBottle !== "boolean") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "El campo returns_bottle debe ser verdadero o falso."
      )
    }

    const metadata = {
      ...(item.product?.metadata ?? {}),
      ...(item.variant?.product?.metadata ?? {}),
      ...(item.variant?.metadata ?? {}),
    }

    if (metadata.is_returnable !== true) {
      continue
    }

    if (returnsBottle === true) {
      emptyBottlesToCollect += quantity
      continue
    }

    const depositPrice = Number(metadata.bottle_deposit_price)
    if (!Number.isFinite(depositPrice) || depositPrice <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El producto retornable "${item.id}" no tiene un bottle_deposit_price válido configurado.`
      )
    }

    bottleDepositTotal += depositPrice * quantity
    depositGroups.set(
      depositPrice,
      (depositGroups.get(depositPrice) ?? 0) + quantity
    )
  }

  return {
    summary: {
      beverage_subtotal: roundCurrency(beverageSubtotal),
      bottle_deposit_total: roundCurrency(bottleDepositTotal),
      empty_bottles_to_collect: emptyBottlesToCollect,
    },
    depositGroups,
  }
}

export async function syncReturnablePackaging(
  cartId: string,
  scope: MedusaContainer
): Promise<void> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "metadata",
      "items.id",
      "items.product_id",
      "items.variant_id",
      "items.quantity",
      "items.unit_price",
      "items.subtotal",
      "items.metadata",
      "items.variant.metadata",
      "items.variant.product.metadata",
      "items.product.metadata",
    ],
    filters: { id: cartId },
  })
  const cart = data[0]

  if (!cart) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No se encontró el carrito "${cartId}".`
    )
  }

  const items = cart.items as PackagingItem[]
  const existingDepositLines = items.filter(isDepositLine)
  const products = items.filter((item) => !isDepositLine(item))
  const { summary, depositGroups } = calculatePackaging(products)
  const cartModule = scope.resolve<ICartModuleService>(Modules.CART)
  const unmatchedLines = new Map<number, PackagingItem[]>()
  for (const line of existingDepositLines) {
    const unitPrice = Number(line.metadata?.bottle_deposit_unit_price)
    const matchingLines = unmatchedLines.get(unitPrice) ?? []
    matchingLines.push(line)
    unmatchedLines.set(unitPrice, matchingLines)
  }

  const linesToDelete: string[] = []
  const linesToCreate: CreateLineItemForCartDTO[] = []
  let lineItemsChanged = false

  for (const [unitPrice, bottleCount] of depositGroups) {
    const matchingLines = unmatchedLines.get(unitPrice) ?? []
    const existingLine = matchingLines.shift()
    unmatchedLines.set(unitPrice, matchingLines)
    const metadata = {
      [DEPOSIT_LINE_METADATA_KEY]: true,
      bottle_count: bottleCount,
      bottle_deposit_unit_price: unitPrice,
      bottle_deposit_total: roundCurrency(unitPrice * bottleCount),
    }
    const lineData = {
      title: "Depósito de envase retornable",
      product_title: "Depósito de envase retornable",
      quantity: bottleCount,
      unit_price: unitPrice,
      is_custom_price: true,
      is_discountable: false,
      requires_shipping: false,
      metadata,
    }

    if (existingLine) {
      if (
        Number(existingLine.quantity) !== bottleCount ||
        Number(existingLine.unit_price) !== unitPrice ||
        Number(existingLine.metadata?.bottle_count) !== bottleCount ||
        Number(existingLine.metadata?.bottle_deposit_total) !==
          metadata.bottle_deposit_total
      ) {
        await cartModule.updateLineItems(existingLine.id, lineData)
        lineItemsChanged = true
      }
    } else {
      linesToCreate.push({ cart_id: cartId, ...lineData })
    }
  }

  for (const lines of unmatchedLines.values()) {
    linesToDelete.push(...lines.map((line) => line.id))
  }
  if (linesToDelete.length) {
    await cartModule.softDeleteLineItems(linesToDelete)
    lineItemsChanged = true
  }
  if (linesToCreate.length) {
    await cartModule.addLineItems(linesToCreate)
    lineItemsChanged = true
  }

  const nextCartMetadata = {
    ...(cart.metadata ?? {}),
    [PACKAGING_SUMMARY_KEY]: summary,
  }

  await cartModule.updateCarts(cartId, { metadata: nextCartMetadata })

  if (!lineItemsChanged) {
    return
  }

  const refreshedCart = await query.graph({
    entity: "cart",
    fields: [
      "items.id",
      "items.is_giftcard",
      "items.product_id",
      "items.product_type_id",
      "items.quantity",
      "items.unit_price",
    ],
    filters: { id: cartId },
  })
  const refreshedItems = refreshedCart.data[0]?.items ?? []
  const workflowEngine = scope.resolve(Modules.WORKFLOW_ENGINE)

  await workflowEngine.run(refreshCartItemsWorkflowId, {
    input: {
      cart_id: cartId,
      items: refreshedItems,
    },
  })
}

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function isDepositLine(item: PackagingItem): boolean {
  return (
    item.metadata?.[DEPOSIT_LINE_METADATA_KEY] === true &&
    !item.product_id &&
    !item.variant_id
  )
}
