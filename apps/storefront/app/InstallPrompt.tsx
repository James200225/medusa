"use client"

import { useEffect, useState } from "react"

const DISMISSED_KEY = "tada-install-prompt-dismissed"

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

export default function InstallPrompt() {
  const [isMobile, setIsMobile] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [canPrompt, setCanPrompt] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null
  )

  useEffect(() => {
    const mobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    const ios = isIosDevice()

    setIsMobile(mobile)
    setIsIos(ios)
    setIsInstalled(isStandalone())
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "true")
    } catch {
      setDismissed(false)
    }

    let installEvent: InstallPromptEvent | null = null

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      installEvent = event as InstallPromptEvent
      setInstallEvent(installEvent)
      setCanPrompt(true)
    }

    function onAppInstalled() {
      setIsInstalled(true)
      setCanPrompt(false)
      setInstallEvent(null)
      setShowIosHelp(false)
      try {
        localStorage.removeItem(DISMISSED_KEY)
      } catch {
        setDismissed(false)
      }
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onAppInstalled)
    }
  }, [])

  async function installApp() {
    if (isIos) {
      setShowIosHelp((visible) => !visible)
      return
    }

    if (canPrompt) {
      if (installEvent) {
        await installEvent.prompt()
        const choice = await installEvent.userChoice
        if (choice.outcome === "accepted") {
          setIsInstalled(true)
        }
        setCanPrompt(false)
        setInstallEvent(null)
        return
      }
    }

    setShowIosHelp((visible) => !visible)
  }

  function dismissPrompt() {
    try {
      localStorage.setItem(DISMISSED_KEY, "true")
    } catch {
      setDismissed(true)
      return
    }
    setDismissed(true)
  }

  if (!isMobile || isInstalled || dismissed) {
    return null
  }

  return (
    <aside className="install-prompt" aria-label="Instala TaDa Delivery">
      <span className="install-prompt-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <path d="M10 18.5h4" />
        </svg>
      </span>
      <div className="install-prompt-copy">
        <strong>Instala TaDa para pedir más rápido</strong>
        {showIosHelp && (
          <p role="status">
            {isIos
              ? "Toca el botón Compartir y selecciona “Agregar a la pantalla de inicio”."
              : "Abre el menú del navegador y selecciona “Instalar aplicación” o “Agregar a la pantalla de inicio”."}
          </p>
        )}
      </div>
      <button
        className="install-prompt-action"
        type="button"
        onClick={() => void installApp()}
        aria-expanded={showIosHelp}
      >
        Instalar
      </button>
      <button
        className="install-prompt-dismiss"
        type="button"
        onClick={dismissPrompt}
        aria-label="Ahora no"
      >
        ×
      </button>
    </aside>
  )
}
