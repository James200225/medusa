import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "TaDa Delivery | Bebidas frías, rápido",
  description:
    "Pide bebidas frías, snacks y más. Entregas locales en 30–45 minutos.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
