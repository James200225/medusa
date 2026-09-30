"use client"

import { ReactNode, useEffect, useState } from "react"

const AGE_VERIFIED_KEY = "tada_age_verified"
const AGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

function hasAgeVerificationCookie() {
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${AGE_VERIFIED_KEY}=1`)
}

export default function AgeGate({ children }: { children: ReactNode }) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    let storedVerification = false
    try {
      storedVerification =
        window.localStorage.getItem(AGE_VERIFIED_KEY) !== null
    } catch {
      storedVerification = false
    }
    setIsVerified(storedVerification || hasAgeVerificationCookie())
  }, [])

  useEffect(() => {
    if (isVerified) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isVerified])

  function verifyAdultAge() {
    try {
      window.localStorage.setItem(AGE_VERIFIED_KEY, "true")
    } catch {
      // The cookie below still keeps the confirmation across page loads.
    }
    const secureAttribute =
      window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `${AGE_VERIFIED_KEY}=1; Max-Age=${AGE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureAttribute}`
    setIsBlocked(false)
    setIsVerified(true)
  }

  return (
    <>
      <div className="age-gated-content" inert={!isVerified}>
        {children}
      </div>
      {!isVerified && (
        <div className="age-gate-backdrop">
          <section
            className="age-gate-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="age-gate-title"
            aria-describedby="age-gate-description"
          >
            <span className="age-gate-mark" aria-hidden="true">
              TA<span>·</span>DA
            </span>
            <span className="eyebrow">VENTA RESPONSABLE</span>
            <h1 id="age-gate-title">¿Tienes más de 18 años?</h1>
            <p id="age-gate-description">
              Debes ser mayor de edad para ingresar a TaDa Delivery.
            </p>
            {isBlocked ? (
              <p className="age-gate-blocked" role="status">
                No puedes ingresar. La venta de bebidas alcohólicas es solo para
                mayores de 18 años.
              </p>
            ) : (
              <div className="age-gate-actions">
                <button
                  className="age-gate-confirm"
                  type="button"
                  onClick={verifyAdultAge}
                  autoFocus
                >
                  Soy mayor de 18
                </button>
                <button
                  className="age-gate-deny"
                  type="button"
                  onClick={() => setIsBlocked(true)}
                >
                  Soy menor de edad
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
