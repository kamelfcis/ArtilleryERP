import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AppLayoutWrapper } from '@/components/layout/AppLayoutWrapper'
import { Toaster } from '@/components/ui/toaster'

const cairo = Cairo({ 
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cairo'
})

export const metadata: Metadata = {
  title: 'نظام الحجوزات - Military Hospitality CRM',
  description: 'نظام إدارة الحجوزات للضيافة العسكرية',
  icons: {
    icon: '/logo.jpeg',
    shortcut: '/logo.jpeg',
    apple: '/logo.jpeg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cairo.className}>
        <QueryProvider>
          <AuthProvider>
            <AppLayoutWrapper>{children}</AppLayoutWrapper>
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
