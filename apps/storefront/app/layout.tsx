import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import AgeGate from "./AgeGate"
import InstallPrompt from "./InstallPrompt"
import "./globals.css"

export const metadata: Metadata = {
  title: "TaDa Delivery | Bebidas frías, rápido",
  description:
    "Pide bebidas frías, snacks y más. Entregas locales en 30–45 minutos.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TaDa",
  },
  icons: {
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: "#0B0B0E",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AgeGate>
          {children}
          <InstallPrompt />
        </AgeGate>
      </body>
    </html>
  )
}
