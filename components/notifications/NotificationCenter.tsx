'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Clock,
  User,
  Home,
  Calendar,
  DollarSign,
  MapPin,
} from 'lucide-react'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  useBookingNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/lib/hooks/use-booking-notifications'
import { motion, AnimatePresence } from 'framer-motion'

interface LegacyNotification {
  id: string
  type: 'reservation' | 'checkin' | 'checkout' | 'payment' | 'system'
  title: string
  message: string
  link?: string
  read: boolean
  created_at: string
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { hasRole } = useAuth()
  const isBranchManager = hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any)

  const { data: bookingNotifications } = useBookingNotifications()
  const { data: unreadBookingCount } = useUnreadNotificationCount()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const { data: legacyNotifications } = useQuery({
    queryKey: ['legacy-notifications'],
    queryFn: async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: upcomingCheckIns } = await supabase
        .from('reservations')
        .select('*, guest:guests(*), unit:units(*)')
        .eq('status', 'confirmed')
        .gte('check_in_date', new Date().toISOString().split('T')[0])
        .lte('check_in_date', tomorrow.toISOString().split('T')[0])
        .limit(10)

      const { data: upcomingCheckOuts } = await supabase
        .from('reservations')
        .select('*, guest:guests(*), unit:units(*)')
        .eq('status', 'checked_in')
        .gte('check_out_date', new Date().toISOString().split('T')[0])
        .lte('check_out_date', tomorrow.toISOString().split('T')[0])
        .limit(10)

      const list: LegacyNotification[] = []

      upcomingCheckIns?.forEach((r) => {
        list.push({
          id: `checkin-${r.id}`,
          type: 'checkin',
          title: 'تسجيل دخول قادم',
          message: `حجز ${r.reservation_number} - ${r.guest?.first_name_ar || r.guest?.first_name} ${r.guest?.last_name_ar || r.guest?.last_name}`,
          link: `/reservations/${r.id}`,
          read: false,
          created_at: r.check_in_date,
        })
      })

      upcomingCheckOuts?.forEach((r) => {
        list.push({
          id: `checkout-${r.id}`,
          type: 'checkout',
          title: 'تسجيل خروج قادم',
          message: `حجز ${r.reservation_number} - ${r.guest?.first_name_ar || r.guest?.first_name} ${r.guest?.last_name_ar || r.guest?.last_name}`,
          link: `/reservations/${r.id}`,
          read: false,
          created_at: r.check_out_date,
        })
      })

      return list.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
    refetchInterval: 60000,
  })

  const totalUnread = (unreadBookingCount ?? 0) + (legacyNotifications?.filter(n => !n.read).length ?? 0)

  function handleBookingNotifClick(notifId: string, reservationId: string) {
    markRead.mutate(notifId)
    router.push(`/reservations/${reservationId}`)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <motion.div
            animate={totalUnread > 0 ? { rotate: [0, -8, 8, -5, 5, 0] } : {}}
            transition={{ duration: 0.6, repeat: totalUnread > 0 ? Infinity : 0, repeatDelay: 4 }}
          >
            <Bell className="h-5 w-5 transition-colors group-hover:text-orange-500" />
          </motion.div>
          <AnimatePresence>
            {totalUnread > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <span className="relative flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex items-center justify-center h-5 w-5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-[10px] font-bold text-white shadow-lg">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[420px] p-0 rounded-2xl border-0 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-white" />
              <span className="text-base font-bold text-white">الإشعارات</span>
            </div>
            <div className="flex items-center gap-2">
              {(unreadBookingCount ?? 0) > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-white/90 hover:text-white hover:bg-white/20"
                  onClick={() => markAllRead.mutate()}
                >
                  <CheckCheck className="h-3 w-3 ml-1" />
                  قراءة الكل
                </Button>
              )}
              {totalUnread > 0 && (
                <Badge className="bg-white/20 text-white border-0 text-xs">
                  {totalUnread} غير مقروء
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-[32rem] overflow-y-auto bg-white dark:bg-slate-900">
          {/* Booking approval notifications */}
          {!isBranchManager && bookingNotifications && bookingNotifications.length > 0 && (
            <div className="p-3">
              <div className="text-xs font-bold text-orange-600 dark:text-orange-400 px-2 py-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" />
                حجوزات بانتظار الموافقة
              </div>
              <div className="space-y-2 mt-1">
                {bookingNotifications.slice(0, 6).map((notif, index) => {
                  const guestName = notif.reservation?.guest
                    ? `${notif.reservation.guest.first_name_ar || notif.reservation.guest.first_name} ${notif.reservation.guest.last_name_ar || notif.reservation.guest.last_name}`
                    : ''
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 border group ${
                        !notif.is_read
                          ? 'bg-gradient-to-r from-orange-50 to-amber-50/60 dark:from-orange-950/30 dark:to-amber-950/20 border-orange-200/70 dark:border-orange-800/40 hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/10'
                          : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                      }`}
                      onClick={() => handleBookingNotifClick(notif.id, notif.reservation_id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${
                          !notif.is_read
                            ? 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-md shadow-orange-500/20'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}>
                          <Calendar className={`h-4.5 w-4.5 ${!notif.is_read ? 'text-white' : 'text-slate-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
                              {notif.reservation?.reservation_number}
                            </span>
                            {!notif.is_read && (
                              <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                            )}
                          </div>
                          <p className="text-sm font-semibold mt-1 truncate text-slate-800 dark:text-slate-200">
                            {guestName}
                          </p>
                          {notif.reservation?.unit && (
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Home className="h-3 w-3" />
                                {notif.reservation.unit.unit_number}
                              </span>
                              {notif.reservation.total_amount > 0 && (
                                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                  <DollarSign className="h-3 w-3" />
                                  {formatCurrency(notif.reservation.total_amount)}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            {formatDateShort(notif.created_at)}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
              {bookingNotifications.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs h-9 mt-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30 rounded-xl font-semibold"
                  onClick={() => { router.push('/pending-reservations'); setOpen(false) }}
                >
                  عرض جميع الحجوزات المعلقة ({bookingNotifications.length})
                </Button>
              )}
            </div>
          )}

          {/* Legacy notifications */}
          {legacyNotifications && legacyNotifications.length > 0 && (
            <div className="p-3">
              {!isBranchManager && bookingNotifications && bookingNotifications.length > 0 && (
                <div className="border-t mb-3" />
              )}
              <div className="text-xs font-bold text-muted-foreground px-2 py-1.5 uppercase tracking-wider">تنبيهات النظام</div>
              <div className="space-y-1.5 mt-1">
                {legacyNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-3 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all"
                    onClick={() => {
                      if (notification.link) { router.push(notification.link); setOpen(false) }
                    }}
                  >
                    <p className="text-sm font-semibold">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{formatDateShort(notification.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!bookingNotifications || bookingNotifications.length === 0) &&
           (!legacyNotifications || legacyNotifications.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mb-4">
                <Bell className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">لا توجد إشعارات</p>
              <p className="text-xs text-muted-foreground mt-1">ستظهر الإشعارات هنا عند وصول حجوزات جديدة</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
