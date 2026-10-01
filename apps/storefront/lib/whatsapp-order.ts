import { money } from "./store-api"

export type WhatsAppOrderItem = {
  title: string
  quantity: number
  returnsBottle: boolean
  servesCold: boolean
}

export type WhatsAppOrderMessageInput = {
  receiverName: string
  contactPhone: string
  deliveryAddress: string
  latitude: number
  longitude: number
  deliveryReference: string
  paymentMethod: "bank_transfer" | "cash"
  cashReceived: number
  currencyCode: string
  items: WhatsAppOrderItem[]
  beverageSubtotal: number
  depositTotal: number
  deliveryTotal: number
  total: number
}

export function buildWhatsAppOrderMessage(
  input: WhatsAppOrderMessageInput
): string {
  const bottlesToCollect = input.items.reduce((total, item) => {
    if (!item.returnsBottle) {
      return total
    }
    return total + item.quantity
  }, 0)
  const coordinates = `${input.latitude.toFixed(6)},${input.longitude.toFixed(
    6
  )}`
  const mapsUrl = `https://maps.google.com/?q=${coordinates}`
  const paymentDescription =
    input.paymentMethod === "cash"
      ? `Paga con: ${money(
          input.cashReceived,
          input.currencyCode
        )} | Llevar cambio de: ${money(
          input.cashReceived - input.total,
          input.currencyCode
        )}`
      : "Transferencia bancaria\nSe te enviarán los datos bancarios al chat."

  return [
    "🍺 *NUEVO PEDIDO - TADA DELIVERY*",
    "",
    `Cliente: ${input.receiverName.trim()}`,
    `Contacto: ${input.contactPhone.trim()}`,
    "",
    `Dirección: ${input.deliveryAddress}`,
    `Ubicación: ${mapsUrl}`,
    `Referencia: ${
      input.deliveryReference.trim() || "Sin referencia adicional"
    }`,
    "",
    "*PRODUCTOS*",
    ...input.items.map(
      (item) =>
        `• ${item.title} x ${item.quantity}${
          item.servesCold ? " · ❄️ Bien frío" : ""
        }`
    ),
    "",
    `Subtotal bebidas: ${money(input.beverageSubtotal, input.currencyCode)}`,
    `Depósito de envases: ${money(input.depositTotal, input.currencyCode)}`,
    `Costo de envío: ${
      input.deliveryTotal > 0
        ? money(input.deliveryTotal, input.currencyCode)
        : "por confirmar"
    }`,
    ...(bottlesToCollect > 0
      ? [`🍾 Botellas vacías a recolectar en la puerta: ${bottlesToCollect}`]
      : []),
    "",
    `Método de pago: ${paymentDescription}`,
    "",
    `💵 *TOTAL A COBRAR: ${money(input.total, input.currencyCode)}*`,
  ].join("\n")
}
