import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'AI Support Agent',
  description: 'Intelligent AI-powered support agent — available 24/7',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
