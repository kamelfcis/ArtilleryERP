'use client'

import { useEffect, useState } from 'react'
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
import { Menu, ImageDown, ClipboardCopy, Printer, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import Image from 'next/image'
import { CalendarToolbarFilters } from '@/components/calendar/CalendarToolbarFilters'
import { cn } from '@/lib/utils'

function dispatchCalendarNavShift(days: number) {
  window.dispatchEvent(new CustomEvent('calendar:nav-shift', { detail: { days } }))
}

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
  const [dragNights, setDragNights] = useState(0)

  useEffect(() => {
    setCollapsed(isCalendarPage)
  }, [isCalendarPage, setCollapsed])

  useEffect(() => {
    if (!isCalendarPage) return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ nights: number }>).detail
      setDragNights(detail?.nights ?? 0)
    }
    window.addEventListener('calendar:drag-nights', handler)
    return () => window.removeEventListener('calendar:drag-nights', handler)
  }, [isCalendarPage])

  return (
    <div className="flex h-dvh overflow-hidden">
      <InAppNotificationBanner />
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        <div
          className={cn(
            'sticky top-0 z-10 bg-background border-b shrink-0',
            isCalendarPage
              ? 'grid grid-cols-[auto_1fr_auto] items-center gap-1.5 md:gap-3 px-3 py-1.5 md:px-4 md:py-2'
              : 'grid grid-cols-3 items-center px-3 py-2 md:p-4'
          )}
        >
          <div className="flex items-center gap-2 md:gap-3 min-w-0 justify-start">
            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              title={collapsed ? 'فتح القائمة' : 'إغلاق القائمة'}
              className="hidden md:inline-flex shrink-0"
            >
              <Menu className="h-6 w-6" />
            </Button>
            {/* Mobile hamburger menu */}
            <MobileMenu />
            {isCalendarPage ? (
              <div className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-indigo-200/60 dark:border-indigo-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md px-1.5 sm:px-2 py-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => dispatchCalendarNavShift(-7)}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
                  title="الأسبوع السابق"
                >
                  <ChevronsRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <div className="hidden sm:block w-px h-6 bg-indigo-200/70 dark:bg-indigo-700/70 shrink-0" aria-hidden />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                  title="اليوم السابق"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                {dragNights > 0 ? (
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-extrabold shadow-md select-none whitespace-nowrap">
                    {dragNights} {dragNights === 1 ? 'ليلة' : 'ليالٍ'}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1 select-none hidden sm:inline">التنقل</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all"
                  title="اليوم التالي"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="hidden sm:block w-px h-6 bg-indigo-200/70 dark:bg-indigo-700/70 shrink-0" aria-hidden />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => dispatchCalendarNavShift(7)}
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg transition-all"
                  title="الأسبوع التالي"
                >
                  <ChevronsLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mobile-hidden">
                <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-slate-200 dark:ring-slate-700">
                  <Image
                    src="/logo.jpeg"
                    alt="Logo"
                    fill
                    sizes="40px"
                    className="object-cover"
                    priority
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">مرحباً، {user?.email}</h2>
                  <p className="text-xs text-muted-foreground">نوادي و فنادق ادارة المدفعية</p>
                </div>
              </div>
            )}
          </div>
          {/* Center column — location filter (calendar page only) */}
          <div className="flex justify-center min-w-0 overflow-hidden">
            {isCalendarPage && <CalendarToolbarFilters />}
          </div>

          {/* Right column */}
          <div className="flex items-center gap-2 justify-end">
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
        <div className={`flex-1 min-h-0 flex flex-col ${isCalendarPage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
          <div className={`${!isCalendarPage ? 'p-3 md:p-6' : 'flex-1 min-h-0 flex flex-col overflow-hidden'}`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
