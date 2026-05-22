import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Family Feud',
  description: 'Interactive Family Feud Game',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
