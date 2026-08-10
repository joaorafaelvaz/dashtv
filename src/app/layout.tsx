import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'
import './globals.css'

/**
 * Archivo é baixada no build e servida pelo próprio domínio (next/font),
 * então o kiosk não depende de rede externa em runtime.
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Dashboard TV — Barbearia VIP',
  description: 'Painel franqueadora para TV portrait',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body className={archivo.className}>{children}</body>
    </html>
  )
}
