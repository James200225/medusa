"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  CartLine,
  DeliveryCoverage,
  StoreCart,
  StoreProduct,
  StoreRegion,
  cartFields,
  money,
  storeApi,
} from "@/lib/store-api"
import { getStoreHoursStatus, type StoreHoursStatus } from "@/lib/store-hours"
import { buildWhatsAppOrderMessage } from "@/lib/whatsapp-order"

const CART_KEY = "tada-medusa-cart"
const LOCATION_KEY = "tada-delivery-location"
const PRODUCT_FIELDS =
  "id,title,handle,description,thumbnail,*images,*categories,*variants,*variants.calculated_price,*variants.inventory_quantity,*variants.manage_inventory,+metadata"
let cartInitialization: Promise<StoreCart> | null = null

const QUICK_CATEGORIES = [
  { label: "Cervezas", handle: "cervezas", art: "beer" },
  { label: "Retornables", handle: "retornables", art: "returnable" },
  { label: "Licores", handle: "licores", art: "spirits" },
  { label: "Snacks", handle: "bebidas-snacks", art: "snacks" },
]

type SelectedLocation = {
  address: string
  latitude: number
  longitude: number
  estimated_delivery_time?: string
  sales_channel_id?: string
}

type CheckoutPaymentMethod = "bank_transfer" | "cash"

type CheckoutDetails = {
  receiverName: string
  contactPhone: string
  deliveryReference: string
  paymentMethod: CheckoutPaymentMethod
  cashReceived: string
}

function productPrice(product: StoreProduct) {
  const variant = product.variants?.[0]
  return {
    variant,
    price: variant?.calculated_price?.calculated_amount ?? 0,
    currency: variant?.calculated_price?.currency_code ?? "USD",
  }
}

function productImage(product: StoreProduct) {
  return product.thumbnail ?? product.images?.[0]?.url ?? ""
}

function isReturnable(product: StoreProduct) {
  return product.metadata?.is_returnable === true
}

function isCold(product: StoreProduct) {
  return product.metadata?.serves_cold === true
}

function depositPrice(product: StoreProduct) {
  const price = Number(product.metadata?.bottle_deposit_price)
  return Number.isFinite(price) ? price : 0.25
}

function stockIsEmpty(product: StoreProduct) {
  const variant = product.variants?.[0]
  return (
    variant?.manage_inventory === true &&
    typeof variant.inventory_quantity === "number" &&
    variant.inventory_quantity <= 0
  )
}

function CategoryIcon({ type }: { type: string }) {
  if (type === "beer") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M19 14h25l-3 38H22l-3-38Z" />
        <path d="M23 9h18M25 22h14M44 21h5a7 7 0 0 1 0 14h-5" />
        <path d="M21 41h21" />
      </svg>
    )
  }
  if (type === "returnable") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M25 8h14v9l5 5v29a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V22l5-5V8Z" />
        <path d="M25 8h14M20 29h24M27 38a8 8 0 0 0 13 5" />
      </svg>
    )
  }
  if (type === "spirits") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M25 9h14v10l7 8v24a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V27l7-8V9Z" />
        <path d="M25 9h14M20 35h24M28 43h8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="m11 25 21-12 21 12-21 12-21-12Z" />
      <path d="M11 25v16l21 12 21-12V25M22 19l21 12M20 34l13 7 12-7" />
    </svg>
  )
}

function ProductImage({
  src,
  title,
  returnable,
}: {
  src: string
  title: string
  returnable: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="product-placeholder" aria-hidden="true">
        <CategoryIcon type={returnable ? "returnable" : "beer"} />
      </div>
    )
  }

  return (
    // Product images come from Medusa's configured file provider.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={title} loading="lazy" onError={() => setFailed(true)} />
  )
}

function SnowflakeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2v16M3.1 6l13.8 8M3.1 14l13.8-8M7 4l3 3 3-3M7 16l3-3 3 3M3.5 9.5l4 .5-1-4M16.5 10.5l-4-.5 1 4M7.5 14l-1-4-3.5 2M12.5 6l1 4 3.5-2" />
    </svg>
  )
}

function RecycleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m7 3 2-1 2 3-2 1M10 3h3l2 3M16 7l2 3-3 2-1-2M16 10l-1.5 2.5M13 16h-4l-.5-3M10 16H6l-2-3M4 12l-2-3 3-2 1 2M3 9l1.5-2.5" />
    </svg>
  )
}

function Header({
  cartCount,
  location,
  storeHours,
  onOpenCart,
  onOpenLocation,
  onSearch,
}: {
  cartCount: number
  location: SelectedLocation | null
  storeHours: StoreHoursStatus | null
  onOpenCart: () => void
  onOpenLocation: () => void
  onSearch: (value: string) => void
}) {
  return (
    <header className="site-header">
      <div className="header-main page-width">
        <a className="brand" href="/" aria-label="TaDa Delivery, inicio">
          <span className="brand-mark">
            TA<span>·</span>DA
          </span>
          <span className="brand-caption">DELIVERY</span>
        </a>
        <button
          type="button"
          className="delivery-select"
          onClick={onOpenLocation}
          aria-label="Elegir dirección de entrega"
        >
          <span className="pin-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M16 8c0 4-6 10-6 10S4 12 4 8a6 6 0 1 1 12 0Z" />
              <circle cx="10" cy="8" r="2" />
            </svg>
          </span>
          <span className="delivery-copy">
            <span>ENTREGAR EN</span>
            <strong>
              {location?.address ?? "Ingresar dirección"}
              <span className="chevron">⌄</span>
            </strong>
          </span>
        </button>
        <div className="header-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            type="search"
            aria-label="Buscar bebidas"
            placeholder="Busca cervezas, snacks y más"
            onChange={(event) => onSearch(event.currentTarget.value)}
          />
          <kbd>/</kbd>
        </div>
        <button
          type="button"
          className="cart-button"
          onClick={onOpenCart}
          aria-label={`Abrir carrito, ${cartCount} productos`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 4h2l2.1 11.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 8H6" />
            <circle cx="10" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
          </svg>
          <span>Mi pedido</span>
          <b>{cartCount}</b>
        </button>
      </div>
      <div className="header-promise">
        <div className="page-width promise-inner">
          {storeHours?.isOpen ? (
            <span className="store-hours-badge store-hours-open">
              <span className="store-hours-dot" />
              <span>
                Abierto · Entrega en{" "}
                {location?.estimated_delivery_time ?? "30-45 min"}
              </span>
            </span>
          ) : storeHours ? (
            <span className="store-hours-badge store-hours-closed">
              🟡 Cerrado por ahora · Abrimos {storeHours.nextOpening}
            </span>
          ) : (
            <span className="store-hours-badge store-hours-pending">
              Verificando horario de atención…
            </span>
          )}
          <span className="promise-separator">·</span>
          Bebidas bien frías, sin vueltas
        </div>
      </div>
    </header>
  )
}

function ProductCard({
  product,
  cartLine,
  returnsBottleChoice,
  busy,
  onQuantityChange,
  onReturnsBottleChange,
}: {
  product: StoreProduct
  cartLine?: CartLine
  returnsBottleChoice: boolean
  busy: boolean
  onQuantityChange: (product: StoreProduct, quantity: number) => void
  onReturnsBottleChange: (product: StoreProduct, returnsBottle: boolean) => void
}) {
  const { variant, price, currency } = productPrice(product)
  const returnable = isReturnable(product)
  const returnsBottle = cartLine
    ? cartLine.metadata?.returns_bottle === true
    : returnsBottleChoice
  const deposit = depositPrice(product)
  const outOfStock = stockIsEmpty(product)
  const image = productImage(product)

  return (
    <article className="product-card">
      <div className="product-media">
        <ProductImage
          key={image}
          src={image}
          title={product.title}
          returnable={returnable}
        />
        <div className="product-badges">
          {isCold(product) && (
            <span className="badge badge-cold">
              <SnowflakeIcon /> BIEN FRÍA
            </span>
          )}
          {returnable && (
            <span className="badge badge-returnable">
              <RecycleIcon /> RETORNABLE
            </span>
          )}
        </div>
        {outOfStock && <span className="stock-badge">AGOTADO</span>}
      </div>
      <div className="product-info">
        <div className="product-title-line">
          <h3>{product.title}</h3>
        </div>
        <p className="product-category">
          {product.categories?.[0]?.name ?? "Bebidas y más"}
        </p>
        <div className="product-buy-row">
          <div>
            <strong className="product-price">{money(price, currency)}</strong>
            {returnable && !returnsBottle && (
              <span className="price-note">
                {" "}
                + {money(deposit, currency)} envase
              </span>
            )}
          </div>
          {cartLine ? (
            <div
              className="quantity-control"
              aria-label="Cantidad en el carrito"
            >
              <button
                type="button"
                onClick={() => onQuantityChange(product, cartLine.quantity - 1)}
                disabled={busy}
                aria-label={`Quitar una unidad de ${product.title}`}
              >
                −
              </button>
              <span>{cartLine.quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(product, cartLine.quantity + 1)}
                disabled={busy || outOfStock}
                aria-label={`Agregar una unidad de ${product.title}`}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="add-button"
              onClick={() => onQuantityChange(product, 1)}
              disabled={busy || outOfStock || !variant}
            >
              {outOfStock ? "Agotado" : "＋ Añadir"}
            </button>
          )}
        </div>
        {returnable && (
          <div className="return-choice">
            <span>¿Tienes envase?</span>
            <div
              className="choice-buttons"
              role="group"
              aria-label="¿Tienes envase?"
            >
              <button
                type="button"
                className={returnsBottle ? "selected" : ""}
                onClick={() => onReturnsBottleChange(product, true)}
                disabled={busy}
              >
                Sí
              </button>
              <button
                type="button"
                className={!returnsBottle ? "selected" : ""}
                onClick={() => onReturnsBottleChange(product, false)}
                disabled={busy}
              >
                No <em>+{money(deposit, currency)}</em>
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function LocationDialog({
  onClose,
  onSubmit,
  onLocate,
  busy,
  message,
}: {
  onClose: () => void
  onSubmit: (address: string, latitude: number, longitude: number) => void
  onLocate: () => void
  busy: boolean
  message: string
}) {
  const [address, setAddress] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(address.trim(), Number(latitude), Number(longitude))
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="dialog location-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="dialog-close"
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
        >
          ×
        </button>
        <span className="eyebrow">TU ZONA, TU PEDIDO</span>
        <h2 id="location-title">¿A dónde lo llevamos?</h2>
        <p>
          Revisamos si tu dirección está dentro de la cobertura de nuestros
          hubs.
        </p>
        <div className="location-options">
          <button
            type="button"
            className="location-option"
            onClick={onLocate}
            disabled={busy}
          >
            <span className="location-option-icon">⌖</span>
            <span>
              <strong>Detectar mi ubicación actual</strong>
              <small>Usar GPS de este dispositivo</small>
            </span>
            <b>→</b>
          </button>
          <span className="location-divider">O prueba una zona de Quito</span>
          <div className="quick-locations">
            <button
              type="button"
              onClick={() =>
                onSubmit("La Carolina / Centro Norte, Quito", -0.1807, -78.4678)
              }
              disabled={busy}
            >
              <strong>La Carolina</strong>
              <small>Centro Norte</small>
            </button>
            <button
              type="button"
              onClick={() => onSubmit("Cumbayá, Quito", -0.201, -78.4304)}
              disabled={busy}
            >
              <strong>Cumbayá</strong>
              <small>Valle de Quito</small>
            </button>
          </div>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="delivery-address">
            O ingresa dirección y coordenadas
          </label>
          <input
            id="delivery-address"
            value={address}
            onChange={(event) => setAddress(event.currentTarget.value)}
            placeholder="Ej. La Floresta, Quito"
            required
          />
          <div className="coordinates-label">
            <span>Coordenadas GPS</span>
          </div>
          <div className="coordinate-inputs">
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              aria-label="Latitud"
              placeholder="Latitud"
              value={latitude}
              onChange={(event) => setLatitude(event.currentTarget.value)}
              required
            />
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              aria-label="Longitud"
              placeholder="Longitud"
              value={longitude}
              onChange={(event) => setLongitude(event.currentTarget.value)}
              required
            />
          </div>
          {message && <p className="dialog-message">{message}</p>}
          <button className="primary-button full-button" disabled={busy}>
            {busy ? "Revisando cobertura…" : "Confirmar dirección"}
          </button>
        </form>
      </section>
    </div>
  )
}

function CartDrawer({
  cart,
  location,
  storeHours,
  notice,
  onClose,
  onQuantityChange,
  onCheckout,
  busyLineId,
  checkoutDetails,
  onCheckoutDetailsChange,
}: {
  cart: StoreCart | null
  location: SelectedLocation | null
  storeHours: StoreHoursStatus | null
  notice: string
  onClose: () => void
  onQuantityChange: (line: CartLine, quantity: number) => void
  onCheckout: () => void
  busyLineId: string | null
  checkoutDetails: CheckoutDetails
  onCheckoutDetailsChange: (field: keyof CheckoutDetails, value: string) => void
}) {
  const items = cart?.items ?? []
  const beverageItems = items.filter((item) => !isDepositLine(item))
  const deposits = items.filter(isDepositLine)
  const beverageSubtotal = beverageItems.reduce(
    (total, item) => total + Number(item.unit_price) * item.quantity,
    0
  )
  const depositTotal = deposits.reduce(
    (total, item) => total + Number(item.unit_price) * item.quantity,
    0
  )
  const deliveryTotal = cart?.shipping_total ?? 0
  const orderTotal = cart?.total ?? 0
  const cashReceivedAmount = Number(checkoutDetails.cashReceived)
  const cashAmountValid =
    checkoutDetails.paymentMethod !== "cash" ||
    (Number.isFinite(cashReceivedAmount) && cashReceivedAmount >= orderTotal)
  const canConfirm =
    Boolean(location) &&
    Boolean(storeHours?.isOpen) &&
    checkoutDetails.receiverName.trim().length > 0 &&
    checkoutDetails.contactPhone.replace(/\D/g, "").length >= 7 &&
    cashAmountValid

  return (
    <div className="modal-backdrop drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">TU SELECCIÓN</span>
            <h2 id="cart-title">Mi pedido</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            aria-label="Cerrar carrito"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {!beverageItems.length ? (
          <div className="empty-cart">
            <span className="empty-cart-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M7 9h5l4 23h20l5-16H14M19 39a2 2 0 1 0 0 .1M34 39a2 2 0 1 0 0 .1" />
              </svg>
            </span>
            <strong>Tu pedido está esperando</strong>
            <p>Agrega tus bebidas favoritas y las llevamos bien frías.</p>
            <button className="primary-button" onClick={onClose}>
              Explorar bebidas
            </button>
          </div>
        ) : (
          <>
            <div className="cart-lines">
              {items.map((item) => {
                const isDeposit =
                  item.metadata?.returnable_packaging_deposit === true
                return (
                  <div className="cart-line" key={item.id}>
                    <div className="cart-line-image">
                      {item.thumbnail && !isDeposit ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail} alt="" />
                      ) : (
                        <RecycleIcon />
                      )}
                    </div>
                    <div className="cart-line-copy">
                      <strong>{item.product_title ?? item.title}</strong>
                      {!isDeposit &&
                        item.metadata?.returns_bottle === true &&
                        isReturnableCartLine(item) && (
                          <span className="returned-bottle-note">
                            Envase para devolver
                          </span>
                        )}
                      {isDeposit && (
                        <span>Depósito · {item.quantity} envases</span>
                      )}
                      <span>{money(item.unit_price, cart?.currency_code)}</span>
                    </div>
                    {!isDeposit && (
                      <div className="quantity-control compact">
                        <button
                          type="button"
                          onClick={() =>
                            onQuantityChange(item, item.quantity - 1)
                          }
                          disabled={busyLineId === item.id}
                          aria-label="Quitar una unidad"
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onQuantityChange(item, item.quantity + 1)
                          }
                          disabled={busyLineId === item.id}
                          aria-label="Agregar una unidad"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {notice && (
              <div className="drawer-notice" role="status">
                {notice}
              </div>
            )}
            <div className="cart-summary">
              <div>
                <span>Subtotal bebidas</span>
                <strong>{money(beverageSubtotal, cart?.currency_code)}</strong>
              </div>
              <div>
                <span>Depósito de envases</span>
                <strong>{money(depositTotal, cart?.currency_code)}</strong>
              </div>
              <div>
                <span>Tarifa de entrega</span>
                <strong>
                  {deliveryTotal > 0
                    ? money(deliveryTotal, cart?.currency_code)
                    : location
                    ? "Por confirmar"
                    : "Ingresa tu dirección"}
                </strong>
              </div>
              <div className="cart-total">
                <span>Total estimado</span>
                <strong>{money(cart?.total ?? 0, cart?.currency_code)}</strong>
              </div>
            </div>
            <p className="cart-note">
              {location
                ? `Entrega en ${location.address}${
                    location.estimated_delivery_time
                      ? ` · ${location.estimated_delivery_time}`
                      : ""
                  }.`
                : "Confirma primero una dirección para verificar la cobertura."}
            </p>
            <p className="age-delivery-warning">
              ⚠️ El repartidor solicitará tu cédula física original al momento
              de la entrega.
            </p>
            <div className="checkout-fields">
              <label className="checkout-field">
                <span>Nombre y apellido de quien recibe</span>
                <input
                  autoComplete="name"
                  value={checkoutDetails.receiverName}
                  onChange={(event) =>
                    onCheckoutDetailsChange(
                      "receiverName",
                      event.currentTarget.value
                    )
                  }
                  placeholder="Nombre completo"
                  required
                />
              </label>
              <label className="checkout-field">
                <span>Teléfono de contacto</span>
                <input
                  autoComplete="tel"
                  type="tel"
                  inputMode="tel"
                  value={checkoutDetails.contactPhone}
                  onChange={(event) =>
                    onCheckoutDetailsChange(
                      "contactPhone",
                      event.currentTarget.value
                    )
                  }
                  placeholder="09 1234 5678"
                  required
                />
              </label>
              <label className="checkout-field">
                <span>Referencia o detalle de entrega</span>
                <textarea
                  autoComplete="address-line2"
                  value={checkoutDetails.deliveryReference}
                  onChange={(event) =>
                    onCheckoutDetailsChange(
                      "deliveryReference",
                      event.currentTarget.value
                    )
                  }
                  placeholder="Casa, departamento, timbre o portería"
                  rows={2}
                />
              </label>
              <fieldset className="payment-method-field">
                <legend>Método de pago</legend>
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="checkout-payment-method"
                    value="bank_transfer"
                    checked={checkoutDetails.paymentMethod === "bank_transfer"}
                    onChange={() =>
                      onCheckoutDetailsChange("paymentMethod", "bank_transfer")
                    }
                  />
                  <span>
                    <strong>Transferencia bancaria</strong>
                    <small>Se te enviarán los datos bancarios al chat.</small>
                  </span>
                </label>
                <label className="payment-method-option">
                  <input
                    type="radio"
                    name="checkout-payment-method"
                    value="cash"
                    checked={checkoutDetails.paymentMethod === "cash"}
                    onChange={() =>
                      onCheckoutDetailsChange("paymentMethod", "cash")
                    }
                  />
                  <span>
                    <strong>Efectivo al recibir</strong>
                    <small>Paga al repartidor al recibir tu pedido.</small>
                  </span>
                </label>
              </fieldset>
              {checkoutDetails.paymentMethod === "cash" && (
                <div className="cash-payment-fields">
                  <label className="checkout-field">
                    <span>¿Con cuánto pagas?</span>
                    <input
                      type="number"
                      min={orderTotal}
                      step="0.01"
                      inputMode="decimal"
                      value={checkoutDetails.cashReceived}
                      onChange={(event) =>
                        onCheckoutDetailsChange(
                          "cashReceived",
                          event.currentTarget.value
                        )
                      }
                      placeholder={money(orderTotal, cart?.currency_code)}
                    />
                  </label>
                  <div
                    className="cash-quick-amounts"
                    aria-label="Montos rápidos"
                  >
                    {[10, 20, 50].map((amount) => (
                      <button
                        className="cash-quick-amount"
                        type="button"
                        key={amount}
                        onClick={() =>
                          onCheckoutDetailsChange(
                            "cashReceived",
                            String(amount)
                          )
                        }
                        disabled={amount < orderTotal}
                      >
                        ${amount}
                      </button>
                    ))}
                    <button
                      className="cash-quick-amount"
                      type="button"
                      onClick={() =>
                        onCheckoutDetailsChange(
                          "cashReceived",
                          orderTotal.toFixed(2)
                        )
                      }
                    >
                      Monto exacto
                    </button>
                  </div>
                  {checkoutDetails.cashReceived &&
                    Number.isFinite(cashReceivedAmount) && (
                      <p
                        className={`cash-change ${
                          cashAmountValid ? "" : "cash-change-short"
                        }`}
                        role="status"
                      >
                        {cashAmountValid
                          ? `Cambio a devolver: ${money(
                              cashReceivedAmount - orderTotal,
                              cart?.currency_code
                            )}`
                          : `El monto debe cubrir el total de ${money(
                              orderTotal,
                              cart?.currency_code
                            )}.`}
                      </p>
                    )}
                </div>
              )}
            </div>
            <button
              className="primary-button full-button"
              onClick={onCheckout}
              disabled={!canConfirm}
            >
              {!storeHours
                ? "Verificando horario…"
                : !storeHours.isOpen
                ? "Fuera de horario de entrega"
                : !checkoutDetails.receiverName.trim() ||
                  checkoutDetails.contactPhone.replace(/\D/g, "").length < 7
                ? "Completa los datos de quien recibe"
                : !cashAmountValid
                ? "Indica un monto suficiente"
                : "Confirmar pedido por WhatsApp"}
            </button>
            <button className="drawer-continue" onClick={onClose}>
              Seguir comprando
            </button>
          </>
        )}
      </aside>
    </div>
  )
}

function isDepositLine(item: CartLine) {
  return item.metadata?.returnable_packaging_deposit === true
}

function isReturnableCartLine(item: CartLine) {
  return Boolean(item.metadata?.returns_bottle)
}

export default function HomePage() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [region, setRegion] = useState<StoreRegion | null>(null)
  const [cart, setCart] = useState<StoreCart | null>(null)
  const [location, setLocation] = useState<SelectedLocation | null>(null)
  const [storeHours, setStoreHours] = useState<StoreHoursStatus | null>(null)
  const [checkoutDetails, setCheckoutDetails] = useState<CheckoutDetails>({
    receiverName: "",
    contactPhone: "",
    deliveryReference: "",
    paymentMethod: "bank_transfer",
    cashReceived: "",
  })
  const [returnsBottleChoices, setReturnsBottleChoices] = useState<
    Record<string, boolean>
  >({})
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [showLocation, setShowLocation] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [locationMessage, setLocationMessage] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [cartError, setCartError] = useState("")
  const [loading, setLoading] = useState(true)
  const [locationBusy, setLocationBusy] = useState(false)
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null)
  const [busyLineId, setBusyLineId] = useState<string | null>(null)

  function updateCheckoutDetails(field: keyof CheckoutDetails, value: string) {
    setCheckoutDetails((current) => ({
      ...current,
      [field]: value,
      ...(field === "paymentMethod" && value !== "cash"
        ? { cashReceived: "" }
        : {}),
    }))
  }

  useEffect(() => {
    const updateStoreHours = () => {
      setStoreHours(getStoreHoursStatus())
    }
    updateStoreHours()
    const interval = window.setInterval(updateStoreHours, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const loadCart = useCallback(async (cartId: string) => {
    const result = await storeApi<{ cart: StoreCart }>(
      `/store/carts/${encodeURIComponent(cartId)}?${cartFields()}`
    )
    setCart(result.cart)
    return result.cart
  }, [])

  useEffect(() => {
    let cancelled = false
    let savedLocation: SelectedLocation | null = null
    let savedCartId: string | null = null

    try {
      const storedLocation = localStorage.getItem(LOCATION_KEY)
      savedLocation = storedLocation
        ? (JSON.parse(storedLocation) as SelectedLocation)
        : null
      setLocation(savedLocation)
    } catch {
      localStorage.removeItem(LOCATION_KEY)
    }
    savedCartId = localStorage.getItem(CART_KEY)

    async function initializeCart(regionId: string) {
      if (!cartInitialization) {
        cartInitialization = (async () => {
          if (savedCartId) {
            try {
              const existing = await storeApi<{ cart: StoreCart }>(
                `/store/carts/${encodeURIComponent(
                  savedCartId
                )}?${cartFields()}`
              )
              if (existing.cart.region_id === regionId) {
                return existing.cart
              }
            } catch {
              localStorage.removeItem(CART_KEY)
            }
          }

          const created = await storeApi<{ cart: StoreCart }>("/store/carts", {
            method: "POST",
            body: JSON.stringify({
              region_id: regionId,
              sales_channel_id: savedLocation?.sales_channel_id,
            }),
          })
          localStorage.setItem(CART_KEY, created.cart.id)
          return created.cart
        })()
      }

      try {
        return await cartInitialization
      } finally {
        cartInitialization = null
      }
    }

    async function loadStore() {
      setLoading(true)
      try {
        const regionResult = await storeApi<{ regions: StoreRegion[] }>(
          "/store/regions?fields=id,name,currency_code,*countries"
        )
        if (cancelled) {
          return
        }
        const selectedRegion =
          regionResult.regions.find((candidate) =>
            candidate.countries?.some((country) => country.iso_2 === "ec")
          ) ??
          regionResult.regions.find(
            (candidate) => candidate.currency_code === "usd"
          ) ??
          regionResult.regions[0] ??
          null
        if (!selectedRegion) {
          throw new Error("La tienda no tiene una región disponible.")
        }
        setRegion(selectedRegion)

        const productsResult = await storeApi<{ products: StoreProduct[] }>(
          `/store/products?limit=100&region_id=${encodeURIComponent(
            selectedRegion.id
          )}&fields=${encodeURIComponent(PRODUCT_FIELDS)}`
        )
        if (cancelled) {
          return
        }
        setProducts(productsResult.products)
        setError("")
        void initializeCart(selectedRegion.id)
          .then((initializedCart) => {
            if (!cancelled) {
              setCart(initializedCart)
              setCartError("")
            }
          })
          .catch((cartLoadError) => {
            if (!cancelled) {
              setCartError(
                cartLoadError instanceof Error
                  ? cartLoadError.message
                  : "No pudimos preparar tu carrito. Vuelve a intentar al agregar un producto."
              )
            }
          })
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No pudimos cargar la tienda."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStore()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es")
    return products.filter((product) => {
      const categoryMatches =
        !selectedCategory ||
        (selectedCategory === "retornables"
          ? isReturnable(product)
          : product.categories?.some(
              (category) =>
                category.handle === selectedCategory ||
                category.name
                  .toLocaleLowerCase("es")
                  .includes(
                    selectedCategory === "bebidas-snacks"
                      ? "snack"
                      : selectedCategory
                  )
            ))
      const searchableText = [
        product.title,
        product.description,
        ...(product.categories?.map((category) => category.name) ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("es")
      return categoryMatches && (!query || searchableText.includes(query))
    })
  }, [products, search, selectedCategory])

  const cartCount = (cart?.items ?? [])
    .filter((item) => item.product_id || item.variant_id)
    .reduce((sum, item) => sum + item.quantity, 0)

  function findCartLine(variantId?: string) {
    return cart?.items.find(
      (item) =>
        item.variant_id === variantId &&
        !item.metadata?.returnable_packaging_deposit
    )
  }

  async function getOrCreateCart() {
    if (cart) {
      return cart
    }
    if (cartInitialization) {
      const initializedCart = await cartInitialization
      setCart(initializedCart)
      return initializedCart
    }
    const existingId = localStorage.getItem(CART_KEY)
    if (existingId) {
      try {
        const existingCart = await loadCart(existingId)
        if (!region || existingCart.region_id === region.id) {
          return existingCart
        }
      } catch {
        localStorage.removeItem(CART_KEY)
      }
    }
    if (!region) {
      throw new Error("No encontramos la región USD de la tienda.")
    }
    const result = await storeApi<{ cart: StoreCart }>("/store/carts", {
      method: "POST",
      body: JSON.stringify({
        region_id: region.id,
        sales_channel_id: location?.sales_channel_id,
      }),
    })
    localStorage.setItem(CART_KEY, result.cart.id)
    setCart(result.cart)
    setCartError("")
    return result.cart
  }

  async function changeProductQuantity(
    product: StoreProduct,
    quantity: number
  ) {
    const variant = product.variants?.[0]
    if (!variant) {
      setNotice("Este producto todavía no tiene una presentación disponible.")
      return
    }
    setBusyVariantId(variant.id)
    setNotice("")
    try {
      const currentLine = findCartLine(variant.id)
      if (!currentLine && quantity <= 0) {
        return
      }
      if (!currentLine && quantity > 0) {
        const currentCart = await getOrCreateCart()
        const result = await storeApi<{ cart: StoreCart }>(
          `/store/carts/${encodeURIComponent(currentCart.id)}/line-items`,
          {
            method: "POST",
            body: JSON.stringify({
              variant_id: variant.id,
              quantity,
              metadata: {
                returns_bottle: returnsBottleChoices[product.id] ?? false,
              },
            }),
          }
        )
        setCart(result.cart)
        setCartError("")
        setShowCart(true)
        return
      }
      if (!currentLine) {
        return
      }
      const result = await storeApi<{ cart: StoreCart }>(
        `/store/carts/${encodeURIComponent(
          cart!.id
        )}/line-items/${encodeURIComponent(currentLine.id)}`,
        {
          method: "POST",
          body: JSON.stringify({
            quantity,
            metadata: {
              returns_bottle: currentLine.metadata?.returns_bottle === true,
            },
          }),
        }
      )
      setCart(result.cart)
    } catch (actionError) {
      setNotice(
        actionError instanceof Error
          ? actionError.message
          : "No pudimos actualizar tu pedido."
      )
    } finally {
      setBusyVariantId(null)
    }
  }

  async function changeCartLineQuantity(line: CartLine, quantity: number) {
    if (!cart) {
      return
    }
    setBusyLineId(line.id)
    try {
      const result = await storeApi<{ cart: StoreCart }>(
        `/store/carts/${encodeURIComponent(
          cart.id
        )}/line-items/${encodeURIComponent(line.id)}`,
        {
          method: "POST",
          body: JSON.stringify({
            quantity,
            metadata: line.metadata ?? {},
          }),
        }
      )
      setCart(result.cart)
    } catch (actionError) {
      setNotice(
        actionError instanceof Error
          ? actionError.message
          : "No pudimos actualizar tu pedido."
      )
    } finally {
      setBusyLineId(null)
    }
  }

  async function changeReturnsBottle(
    product: StoreProduct,
    returnsBottle: boolean
  ) {
    setReturnsBottleChoices((choices) => ({
      ...choices,
      [product.id]: returnsBottle,
    }))
    const variant = product.variants?.[0]
    const line = findCartLine(variant?.id)
    if (!line || !cart) {
      setNotice("")
      return
    }
    setBusyVariantId(variant?.id ?? null)
    setNotice("")
    try {
      const result = await storeApi<{ cart: StoreCart }>(
        `/store/carts/${encodeURIComponent(
          cart.id
        )}/line-items/${encodeURIComponent(line.id)}`,
        {
          method: "POST",
          body: JSON.stringify({
            quantity: line.quantity,
            metadata: { returns_bottle: returnsBottle },
          }),
        }
      )
      setCart(result.cart)
    } catch (actionError) {
      setNotice(
        actionError instanceof Error
          ? actionError.message
          : "No pudimos actualizar los envases."
      )
    } finally {
      setBusyVariantId(null)
    }
  }

  async function checkCoverage(
    address: string,
    latitude: number,
    longitude: number
  ) {
    if (
      !address ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setLocationMessage("Ingresa una dirección y coordenadas GPS válidas.")
      return
    }
    setLocationBusy(true)
    setLocationMessage("")
    try {
      const currentCart = await getOrCreateCart()
      const result = await storeApi<DeliveryCoverage>(
        "/store/delivery-coverage",
        {
          method: "POST",
          body: JSON.stringify({
            latitude,
            longitude,
            cart_id: currentCart.id,
          }),
        }
      )
      if (!result.has_coverage) {
        setLocationMessage(result.message ?? "Aún no llegamos a tu zona.")
        return
      }
      const nextLocation: SelectedLocation = {
        address,
        latitude,
        longitude,
        estimated_delivery_time: result.estimated_delivery_time,
        sales_channel_id: result.sales_channel_id,
      }
      setLocation(nextLocation)
      localStorage.setItem(LOCATION_KEY, JSON.stringify(nextLocation))
      setShowLocation(false)
      await loadCart(currentCart.id)
      setNotice("")
    } catch (coverageError) {
      setLocationMessage(
        coverageError instanceof Error
          ? coverageError.message
          : "No pudimos verificar la cobertura."
      )
    } finally {
      setLocationBusy(false)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Tu navegador no permite obtener la ubicación.")
      return
    }
    setLocationMessage("Obteniendo coordenadas…")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void checkCoverage(
          "Mi ubicación actual",
          position.coords.latitude,
          position.coords.longitude
        )
      },
      () => setLocationMessage("No pudimos obtener tu ubicación GPS."),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function openCart() {
    try {
      await getOrCreateCart()
      setCartError("")
    } catch (cartLoadError) {
      setCartError(
        cartLoadError instanceof Error
          ? cartLoadError.message
          : "No pudimos preparar el carrito. Intenta nuevamente."
      )
    }
    setShowCart(true)
  }

  function sendOrderToWhatsApp() {
    if (!cart || !location) {
      setNotice("Confirma una dirección y agrega productos antes de continuar.")
      return
    }
    if (!storeHours?.isOpen) {
      setNotice(
        "Fuera de horario de entrega. Puedes confirmar tu pedido cuando abramos."
      )
      return
    }
    if (
      !checkoutDetails.receiverName.trim() ||
      checkoutDetails.contactPhone.replace(/\D/g, "").length < 7
    ) {
      setNotice("Completa el nombre y un teléfono de contacto válido.")
      return
    }
    const beverageLines = cart.items.filter((item) => !isDepositLine(item))
    const depositLines = cart.items.filter(isDepositLine)
    const beverageSubtotal = beverageLines.reduce(
      (total, item) => total + Number(item.unit_price) * item.quantity,
      0
    )
    const depositTotal = depositLines.reduce(
      (total, item) => total + Number(item.unit_price) * item.quantity,
      0
    )
    const deliveryTotal = Number(cart.shipping_total ?? 0)
    const whatsappPhone = (
      process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? ""
    ).replace(/\D/g, "")
    if (
      checkoutDetails.paymentMethod === "cash" &&
      (!Number.isFinite(Number(checkoutDetails.cashReceived)) ||
        Number(checkoutDetails.cashReceived) < Number(cart.total))
    ) {
      setNotice("El monto en efectivo debe cubrir el total del pedido.")
      return
    }
    const message = buildWhatsAppOrderMessage({
      receiverName: checkoutDetails.receiverName,
      contactPhone: checkoutDetails.contactPhone,
      deliveryAddress: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      deliveryReference: checkoutDetails.deliveryReference,
      paymentMethod: checkoutDetails.paymentMethod,
      cashReceived: Number(checkoutDetails.cashReceived),
      currencyCode: cart.currency_code,
      items: beverageLines.map((item) => {
        const product = products.find(
          (candidate) => candidate.id === item.product_id
        )
        return {
          title: item.product_title ?? item.title,
          quantity: item.quantity,
          returnsBottle: isReturnableCartLine(item),
          servesCold: product ? isCold(product) : false,
        }
      }),
      beverageSubtotal,
      depositTotal,
      deliveryTotal,
      total: Number(cart.total),
    })
    window.open(
      `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    )
  }

  const displayProducts = filteredProducts

  return (
    <>
      <Header
        cartCount={cartCount}
        location={location}
        storeHours={storeHours}
        onOpenCart={() => void openCart()}
        onOpenLocation={() => {
          setLocationMessage("")
          setShowLocation(true)
        }}
        onSearch={setSearch}
      />
      <main>
        <section className="hero page-width">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span /> EL PLAN EMPIEZA AQUÍ
            </span>
            <h1>
              La noche
              <br />
              <em>se arma</em> con TaDa.
            </h1>
            <p>Pide tus bebidas frías y disfruta. Nosotros llegamos rápido.</p>
            <button
              className="hero-button"
              onClick={() =>
                document
                  .getElementById("featured-products")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Arma tu pedido <span>↗</span>
            </button>
            <div className="hero-delivery">
              <span className="hero-delivery-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
                  <circle cx="7" cy="19" r="2" />
                  <circle cx="18" cy="19" r="2" />
                </svg>
              </span>
              <span>
                <strong>30–45 min</strong>
                <small>en zonas con cobertura</small>
              </span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-beam" />
            <div className="hero-can can-back">
              <span>CLUB</span>
              <small>PREMIUM</small>
            </div>
            <div className="hero-can can-front">
              <span>PILSENER</span>
              <small>BIEN FRÍA</small>
            </div>
            <div className="hero-lemon lemon-one" />
            <div className="hero-lemon lemon-two" />
            <span className="hero-sticker">
              FRÍO
              <br />
              DE VERDAD
            </span>
          </div>
          <div className="hero-bottom-line">
            <span>BUENAS BEBIDAS.</span>
            <span>BUENOS MOMENTOS.</span>
            <span>ASÍ DE FÁCIL.</span>
          </div>
        </section>

        <section
          className="categories-section page-width"
          aria-labelledby="categories-heading"
        >
          <div className="section-heading compact-heading">
            <div>
              <span className="eyebrow">ENCUENTRA TU FAVORITO</span>
              <h2 id="categories-heading">¿Qué se te antoja?</h2>
            </div>
            {selectedCategory && (
              <button
                className="clear-filter"
                onClick={() => setSelectedCategory("")}
              >
                Ver todo <span>↗</span>
              </button>
            )}
          </div>
          <div className="category-row">
            {QUICK_CATEGORIES.map((category, index) => (
              <button
                className={`category-card category-card-${index + 1}${
                  selectedCategory === category.handle ? " active" : ""
                }`}
                key={category.handle}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === category.handle ? "" : category.handle
                  )
                }
                aria-pressed={selectedCategory === category.handle}
              >
                <span className="category-art">
                  <CategoryIcon type={category.art} />
                  <i>{String(index + 1).padStart(2, "0")}</i>
                </span>
                <strong>{category.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section
          className="products-section page-width"
          id="featured-products"
          aria-labelledby="products-heading"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {selectedCategory
                  ? "ENCUENTRA TU FAVORITO"
                  : "PARA QUE DISFRUTES"}
              </span>
              <h2 id="products-heading">
                {search
                  ? `Resultados para “${search}”`
                  : selectedCategory
                  ? QUICK_CATEGORIES.find(
                      (category) => category.handle === selectedCategory
                    )?.label ?? "Productos"
                  : "¿Qué vas a pedir hoy?"}
              </h2>
            </div>
            <span className="product-count">
              {loading ? "Cargando…" : `${displayProducts.length} productos`}
            </span>
          </div>
          {error && (
            <div className="store-alert" role="status">
              <strong>La tienda no está conectada todavía.</strong>
              <span>{error}</span>
              <small>
                Configura `MEDUSA_BACKEND_URL` y `MEDUSA_PUBLISHABLE_KEY` en
                `apps/storefront/.env.local`.
              </small>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Cerrar mensaje"
              >
                ×
              </button>
            </div>
          )}
          {loading ? (
            <div className="product-grid">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="skeleton-card" key={index}>
                  <div />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : displayProducts.length ? (
            <div className="product-grid">
              {displayProducts.map((product) => {
                const variantId = product.variants?.[0]?.id
                const cartLine = findCartLine(variantId)
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    cartLine={cartLine}
                    returnsBottleChoice={
                      returnsBottleChoices[product.id] ?? false
                    }
                    busy={busyVariantId === variantId}
                    onQuantityChange={changeProductQuantity}
                    onReturnsBottleChange={changeReturnsBottle}
                  />
                )
              })}
            </div>
          ) : (
            <div className="empty-products">
              <div className="empty-products-mark">
                TA<span>·</span>DA
              </div>
              <h3>
                {error
                  ? "Conectamos bebidas, no pudimos conectar la tienda."
                  : products.length
                  ? "No encontramos productos con ese filtro."
                  : "Estamos preparando el frío."}
              </h3>
              <p>
                {products.length
                  ? "Prueba otra búsqueda o explora todas las categorías."
                  : "Cuando el catálogo de bebidas esté publicado, aparecerá aquí."}
              </p>
              {selectedCategory && (
                <button
                  className="secondary-button"
                  onClick={() => setSelectedCategory("")}
                >
                  Ver todos los productos
                </button>
              )}
            </div>
          )}
        </section>

        <section className="cold-banner page-width">
          <div className="cold-banner-icon">
            <SnowflakeIcon />
          </div>
          <div>
            <span className="eyebrow">QUE NADA TE FALTE</span>
            <h2>Plan listo. Bebidas frías. TaDa.</h2>
            <p>Tu próxima buena idea está a un pedido de distancia.</p>
          </div>
          <button
            className="cold-banner-button"
            onClick={() =>
              document
                .getElementById("featured-products")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Elegir bebidas <span>↗</span>
          </button>
        </section>
      </main>
      <footer className="site-footer">
        <div className="page-width footer-inner">
          <a className="brand footer-brand" href="/">
            <span className="brand-mark">
              TA<span>·</span>DA
            </span>
            <span className="brand-caption">DELIVERY</span>
          </a>
          <span>Buenas bebidas. Buenos momentos.</span>
          <span>© TaDa Delivery Ecuador</span>
        </div>
      </footer>
      {showLocation && (
        <LocationDialog
          onClose={() => setShowLocation(false)}
          onSubmit={checkCoverage}
          onLocate={useCurrentLocation}
          busy={locationBusy}
          message={locationMessage}
        />
      )}
      {showCart && (
        <CartDrawer
          cart={cart}
          location={location}
          storeHours={storeHours}
          notice={notice || cartError}
          onClose={() => setShowCart(false)}
          onQuantityChange={changeCartLineQuantity}
          onCheckout={sendOrderToWhatsApp}
          busyLineId={busyLineId}
          checkoutDetails={checkoutDetails}
          onCheckoutDetailsChange={updateCheckoutDetails}
        />
      )}
    </>
  )
}
