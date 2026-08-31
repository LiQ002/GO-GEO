import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import AuthGuard from '@/components/layout/AuthGuard'
import ToastContainer from '@/components/ui/ToastContainer'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'GEO助手',
  description: '多平台文章发布助手',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full min-h-full overflow-hidden font-sans">
        <AuthGuard>{children}</AuthGuard>
        <ToastContainer />
      </body>
    </html>
  )
}
