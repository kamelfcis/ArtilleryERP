'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { MobileMenu } from './MobileMenu'
import { QuickActions } from '@/components/quick-actions/QuickActions'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { InAppNotificationBanner } from '@/components/notifications/InAppNotificationBanner'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Menu, ImageDown, ClipboardCopy, Printer } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

async function grabScreen(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' } as any,
    preferCurrentTab: true,
  } as any)
  const track = stream.getVideoTracks()[0]
  const grabber = new (window as any).ImageCapture(track)
  const bitmap = await grabber.grabFrame()
  track.stop()
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed')), 'image/png')
  })
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const isCalendarPage = pathname === '/calendar'
  const { collapsed, setCollapsed, toggle } = useSidebar()

  useEffect(() => {
    setCollapsed(isCalendarPage)
  }, [isCalendarPage, setCollapsed])

  return (
    <div className="flex h-screen overflow-hidden">
      <InAppNotificationBanner />
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="sticky top-0 z-10 bg-background border-b px-3 py-2 md:p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              title={collapsed ? 'فتح القائمة' : 'إغلاق القائمة'}
              className="hidden md:inline-flex"
            >
              <Menu className="h-6 w-6" />
            </Button>
            {/* Mobile hamburger menu */}
            <MobileMenu />
            <div className="flex items-center gap-3 mobile-hidden">
              <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-slate-200 dark:ring-slate-700">
                <Image
                  src="/logo.jpeg"
                  alt="Logo"
                  width={40}
                  height={40}
                  className="object-cover"
                  priority
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold">مرحباً، {user?.email}</h2>
                <p className="text-xs text-muted-foreground">نوادي و فنادق ادارة المدفعية</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isCalendarPage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-200/50 dark:border-emerald-800/50 transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-emerald-500/10"
                  title="تحميل لقطة شاشة"
                  onClick={async () => {
                    try {
                      const blob = await grabScreen()
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.download = `calendar-${new Date().toISOString().slice(0, 10)}.png`
                      link.href = url
                      link.click()
                      URL.revokeObjectURL(url)
                      toast({ title: 'تم تحميل الصورة بنجاح' })
                    } catch {
                      toast({ title: 'فشل في التقاط الصورة', variant: 'destructive' })
                    }
                  }}
                >
                  <ImageDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 border border-blue-200/50 dark:border-blue-800/50 transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-blue-500/10"
                  title="نسخ لقطة شاشة للحافظة"
                  onClick={async () => {
                    try {
                      const blob = await grabScreen()
                      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                      toast({ title: 'تم نسخ الصورة للحافظة' })
                    } catch {
                      toast({ title: 'فشل في نسخ الصورة', variant: 'destructive' })
                    }
                  }}
                >
                  <ClipboardCopy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 hover:from-purple-500/20 hover:to-fuchsia-500/20 border border-purple-200/50 dark:border-purple-800/50 transition-all duration-200 hover:scale-105 hover:shadow-md hover:shadow-purple-500/10"
                  title="طباعة لقطة شاشة"
                  onClick={async () => {
                    try {
                      const blob = await grabScreen()
                      const url = URL.createObjectURL(blob)
                      const win = window.open('')
                      if (win) {
                        win.document.write(`<img src="${url}" onload="window.print();window.close()" style="max-width:100%"/>`)
                      }
                    } catch {
                      toast({ title: 'فشل في الطباعة', variant: 'destructive' })
                    }
                  }}
                >
                  <Printer className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </Button>
              </>
            )}
            <ChangePasswordDialog />
            <NotificationCenter />
            <div className="mobile-hidden">
              <QuickActions />
            </div>
          </div>
        </div>
        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${!isCalendarPage ? '' : ''}`}>
          <div className={`${!isCalendarPage ? 'p-3 md:p-6' : ''}`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
