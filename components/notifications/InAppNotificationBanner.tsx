'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useUpdateReservation } from '@/lib/hooks/use-reservations'
import { useMarkNotificationRead, useCreateBookingNotification } from '@/lib/hooks/use-booking-notifications'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import {
  Bell,
  X,
  CheckCircle,
  XCircle,
  User,
  Home,
  Calendar,
  DollarSign,
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react'
import { RealtimeChannel } from '@supabase/supabase-js'

interface NotificationPayload {
  id: string
  reservation_id: string
  created_by: string
  notify_user_id?: string | null
  message: string
  created_at: string
}

interface ReservationDetail {
  id: string
  reservation_number: string
  check_in_date: string
  check_out_date: string
  total_amount: number
  adults: number
  children: number
  source: string
  guest?: { first_name: string; last_name: string; first_name_ar: string; last_name_ar: string; phone: string }
  unit?: { unit_number: string; name: string; location?: { name: string; name_ar: string } }
}

interface BannerNotification {
  notifId: string
  reservationId: string
  createdBy: string
  notifyUserId?: string | null
  message: string
  createdAt: string
  reservation?: ReservationDetail
  creatorEmail?: string
}

const AUTO_DISMISS_MS = 20000

export function InAppNotificationBanner() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, hasRole, elevatedOps } = useAuth()
  const restrictedBranchManager =
    hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
  const updateReservation = useUpdateReservation()
  const markRead = useMarkNotificationRead()
  const createNotification = useCreateBookingNotification()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [banners, setBanners] = useState<BannerNotification[]>([])
  const processedIdsRef = useRef<Set<string>>(new Set())

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/notification.wav')
        audioRef.current.volume = 0.6
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch {}
  }, [])

  const showBrowserNotification = useCallback((banner: BannerNotification) => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const res = banner.reservation
    const guestName = res?.guest
      ? `${res.guest.first_name_ar || res.guest.first_name} ${res.guest.last_name_ar || res.guest.last_name}`
      : 'ضيف'
    const unitInfo = res?.unit ? `${res.unit.unit_number} — ${res.unit.name}` : ''
    const locationInfo = res?.unit?.location ? (res.unit.location.name_ar || res.unit.location.name) : ''
    const dates = res ? `${res.check_in_date} → ${res.check_out_date}` : ''

    const body = [
      `🏨 ضيف: ${guestName}`,
      unitInfo ? `🏠 الوحدة: ${unitInfo}` : '',
      locationInfo ? `📍 الموقع: ${locationInfo}` : '',
      dates ? `📅 ${dates}` : '',
      res ? `💰 ${formatCurrency(res.total_amount)}` : '',
      banner.creatorEmail ? `👤 بواسطة: ${banner.creatorEmail}` : '',
    ].filter(Boolean).join('\n')

    new Notification('🔔 حجز جديد بانتظار الموافقة', {
      body,
      icon: '/logo.jpeg',
      tag: `booking-${banner.notifId}`,
      requireInteraction: true,
    })
  }, [])

  const dismiss = useCallback((notifId: string) => {
    setBanners(prev => prev.filter(b => b.notifId !== notifId))
  }, [])

  const sendReverseNotif = useCallback((banner: BannerNotification, newStatus: 'confirmed' | 'cancelled') => {
    if (!user?.id || !banner.createdBy) return
    const res = banner.reservation
    const gName = res?.guest
      ? `${res.guest.first_name_ar || res.guest.first_name} ${res.guest.last_name_ar || res.guest.last_name}`
      : ''
    const unitInfo = res?.unit ? `${res.unit.unit_number} — ${res.unit.name}` : ''
    const statusLabel = newStatus === 'confirmed' ? 'تم تأكيد' : 'تم رفض'
    const statusIcon = newStatus === 'confirmed' ? '✅' : '❌'
    createNotification.mutate({
      reservation_id: banner.reservationId,
      created_by: user.id,
      notify_user_id: banner.createdBy,
      message: `${statusIcon} ${statusLabel} حجزك | الضيف: ${gName} | الوحدة: ${unitInfo} | المبلغ: ${res?.total_amount ?? 0} ج.م`,
    })
  }, [user, createNotification])

  const handleConfirm = useCallback(async (banner: BannerNotification) => {
    try {
      await updateReservation.mutateAsync({ id: banner.reservationId, status: 'confirmed' as any })
      markRead.mutate(banner.notifId)
      sendReverseNotif(banner, 'confirmed')
      queryClient.invalidateQueries({ queryKey: ['pending-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['booking-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['booking-notifications-count'] })
      dismiss(banner.notifId)
      toast({ title: '✅ تم تأكيد الحجز بنجاح' })
    } catch {
      toast({ title: 'فشل في تأكيد الحجز', variant: 'destructive' })
    }
  }, [updateReservation, markRead, queryClient, dismiss, sendReverseNotif])

  const handleReject = useCallback(async (banner: BannerNotification) => {
    try {
      await updateReservation.mutateAsync({ id: banner.reservationId, status: 'cancelled' as any })
      markRead.mutate(banner.notifId)
      sendReverseNotif(banner, 'cancelled')
      queryClient.invalidateQueries({ queryKey: ['pending-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['booking-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['booking-notifications-count'] })
      dismiss(banner.notifId)
      toast({ title: '❌ تم رفض الحجز' })
    } catch {
      toast({ title: 'فشل في رفض الحجز', variant: 'destructive' })
    }
  }, [updateReservation, markRead, queryClient, dismiss, sendReverseNotif])

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleNewNotification = useCallback(async (notif: NotificationPayload) => {
    if (processedIdsRef.current.has(notif.id)) return

    // Restricted BranchManagers only see notifications targeted at them
    if (restrictedBranchManager && notif.notify_user_id !== user?.id) return
    // Staff/admins skip BM-only reverse notifications
    if (!restrictedBranchManager && notif.notify_user_id) return

    processedIdsRef.current.add(notif.id)

    playSound()

    let reservation: ReservationDetail | undefined
    try {
      const { data } = await supabase
        .from('reservations')
        .select(`
          id, reservation_number, check_in_date, check_out_date, total_amount, adults, children, source,
          guest:guests(first_name, last_name, first_name_ar, last_name_ar, phone),
          unit:units(unit_number, name, location:locations(name, name_ar))
        `)
        .eq('id', notif.reservation_id)
        .single()
      const raw = data as any
      reservation = raw ? {
        ...raw,
        guest: Array.isArray(raw.guest) ? raw.guest[0] : raw.guest,
        unit: Array.isArray(raw.unit) ? raw.unit[0] : raw.unit,
      } : undefined
    } catch {}

    let creatorEmail: string | undefined
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      const foundUser = json.users?.find((u: any) => u.id === notif.created_by)
      creatorEmail = foundUser?.email
    } catch {}

    const banner: BannerNotification = {
      notifId: notif.id,
      reservationId: notif.reservation_id,
      createdBy: notif.created_by,
      notifyUserId: notif.notify_user_id,
      message: notif.message,
      createdAt: notif.created_at,
      reservation,
      creatorEmail,
    }

    showBrowserNotification(banner)
    setBanners(prev => [banner, ...prev])
    queryClient.invalidateQueries({ queryKey: ['booking-notifications'] })
    queryClient.invalidateQueries({ queryKey: ['booking-notifications-count'] })
    // Auto-refresh calendar when a restricted BranchManager gets a status update
    if (restrictedBranchManager) {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    }

    setTimeout(() => dismiss(notif.id), AUTO_DISMISS_MS)
  }, [playSound, showBrowserNotification, queryClient, dismiss, restrictedBranchManager, user?.id])

  // Realtime subscription for instant notifications
  useEffect(() => {
    const channel = supabase
      .channel('premium-booking-banner')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_notifications' },
        (payload) => { handleNewNotification(payload.new as NotificationPayload) }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Notifications] Realtime connected')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Notifications] Realtime channel error — falling back to polling')
        } else if (status === 'TIMED_OUT') {
          console.error('[Notifications] Realtime timed out — falling back to polling')
        }
      })

    return () => { supabase.removeChannel(channel as RealtimeChannel) }
  }, [handleNewNotification])

  // Polling fallback: check for new unread notifications every 15 seconds
  useEffect(() => {
    const lastCheckedRef = { current: new Date().toISOString() }

    const poll = async () => {
      try {
        const { data } = await supabase
          .from('booking_notifications')
          .select('id, reservation_id, created_by, message, created_at, notify_user_id')
          .eq('is_read', false)
          .gt('created_at', lastCheckedRef.current)
          .order('created_at', { ascending: true })
          .limit(5)

        if (data && data.length > 0) {
          lastCheckedRef.current = data[data.length - 1].created_at
          for (const notif of data) {
            handleNewNotification(notif as NotificationPayload)
          }
        }
      } catch {}
    }

    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [handleNewNotification])

  return (
    <div className="fixed top-4 left-4 z-[9999] flex flex-col gap-3 max-w-md w-full pointer-events-none" dir="rtl">
      <AnimatePresence mode="popLayout">
        {banners.map((banner) => {
          const res = banner.reservation
          const guestName = res?.guest
            ? `${res.guest.first_name_ar || res.guest.first_name} ${res.guest.last_name_ar || res.guest.last_name}`
            : 'ضيف'
          const unitInfo = res?.unit ? `${res.unit.unit_number} — ${res.unit.name}` : ''
          const locationName = res?.unit?.location
            ? (res.unit.location.name_ar || res.unit.location.name)
            : ''
          const nights = res
            ? Math.ceil((new Date(res.check_out_date).getTime() - new Date(res.check_in_date).getTime()) / 86400000)
            : 0
          const isStatusUpdate = !!banner.notifyUserId
          const isConfirmed = banner.message.includes('تم تأكيد')
          const accentColor = isStatusUpdate
            ? (isConfirmed ? 'emerald' : 'red')
            : 'orange'

          return (
            <motion.div
              key={banner.notifId}
              layout
              initial={{ opacity: 0, x: -400, scale: 0.85, rotateY: -15 }}
              animate={{ opacity: 1, x: 0, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, x: -400, scale: 0.85 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="pointer-events-auto"
            >
              <div className={`relative overflow-hidden rounded-2xl border shadow-2xl ${
                isStatusUpdate
                  ? isConfirmed
                    ? 'border-emerald-200/60 dark:border-emerald-700/40 shadow-emerald-500/20'
                    : 'border-red-200/60 dark:border-red-700/40 shadow-red-500/20'
                  : 'border-orange-200/60 dark:border-orange-700/40 shadow-orange-500/20 dark:shadow-orange-500/10'
              }`}>
                <div className={`absolute inset-0 backdrop-blur-xl ${
                  isStatusUpdate
                    ? isConfirmed
                      ? 'bg-gradient-to-br from-white via-emerald-50/80 to-green-50/60 dark:from-slate-900 dark:via-emerald-950/40 dark:to-green-950/30'
                      : 'bg-gradient-to-br from-white via-red-50/80 to-rose-50/60 dark:from-slate-900 dark:via-red-950/40 dark:to-rose-950/30'
                    : 'bg-gradient-to-br from-white via-orange-50/80 to-amber-50/60 dark:from-slate-900 dark:via-orange-950/40 dark:to-amber-950/30'
                }`} />

                <motion.div
                  className={`absolute top-0 right-0 left-0 h-1 ${
                    isStatusUpdate
                      ? isConfirmed
                        ? 'bg-gradient-to-l from-emerald-500 via-green-400 to-teal-400'
                        : 'bg-gradient-to-l from-red-500 via-rose-400 to-pink-400'
                      : 'bg-gradient-to-l from-orange-500 via-amber-400 to-yellow-400'
                  }`}
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
                  style={{ transformOrigin: 'right' }}
                />

                <div className="relative p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className={`flex items-center justify-center w-11 h-11 rounded-xl shadow-lg ${
                          isStatusUpdate
                            ? isConfirmed
                              ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
                              : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30'
                            : 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-orange-500/30'
                        }`}
                      >
                        {isStatusUpdate
                          ? isConfirmed ? <CheckCircle className="h-5 w-5 text-white" /> : <XCircle className="h-5 w-5 text-white" />
                          : <Bell className="h-5 w-5 text-white" />
                        }
                      </motion.div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                            {isStatusUpdate
                              ? isConfirmed ? 'تم تأكيد حجزك' : 'تم رفض حجزك'
                              : 'حجز جديد بانتظار الموافقة'
                            }
                          </h3>
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                          >
                            <Sparkles className={`h-4 w-4 ${isStatusUpdate ? isConfirmed ? 'text-emerald-500' : 'text-red-500' : 'text-amber-500'}`} />
                          </motion.div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {res?.reservation_number && (
                            <span className={`font-mono font-semibold ml-2 ${
                              isStatusUpdate
                                ? isConfirmed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                : 'text-orange-600 dark:text-orange-400'
                            }`}>{res.reservation_number}</span>
                          )}
                          {banner.creatorEmail && `بواسطة ${banner.creatorEmail}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => dismiss(banner.notifId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {res && (
                    <div className="grid grid-cols-2 gap-2.5 mb-4">
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground leading-none">الضيف</p>
                          <p className="text-sm font-semibold truncate mt-0.5">{guestName}</p>
                        </div>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                          <Home className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground leading-none">الوحدة</p>
                          <p className="text-sm font-semibold truncate mt-0.5">{unitInfo || '—'}</p>
                        </div>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                          <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground leading-none">الموقع</p>
                          <p className="text-sm font-semibold truncate mt-0.5">{locationName || '—'}</p>
                        </div>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                          <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground leading-none">المبلغ</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(res.total_amount)}</p>
                        </div>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                        className="col-span-2 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40">
                          <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground leading-none">المدة</p>
                          <p className="text-sm font-semibold mt-0.5">
                            {formatDateShort(res.check_in_date)} → {formatDateShort(res.check_out_date)}
                            <span className="text-xs text-muted-foreground font-normal mr-2">({nights} {nights === 1 ? 'ليلة' : 'ليالي'})</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {res.adults} بالغ{res.children > 0 && ` · ${res.children} طفل`}
                        </div>
                      </motion.div>
                    </div>
                  )}

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex items-center gap-2">
                    {!isStatusUpdate && (
                      <>
                        <Button
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/25 border-0 h-9 rounded-xl font-semibold"
                          onClick={() => handleConfirm(banner)}
                          disabled={updateReservation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 ml-1.5" />
                          تأكيد الحجز
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 shadow-lg shadow-red-500/20 h-9 rounded-xl font-semibold"
                          onClick={() => handleReject(banner)}
                          disabled={updateReservation.isPending}
                        >
                          <XCircle className="h-4 w-4 ml-1.5" />
                          رفض
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-9 rounded-xl border-2 ${isStatusUpdate ? 'flex-1 font-semibold' : 'w-9 p-0'}`}
                      onClick={() => {
                        markRead.mutate(banner.notifId)
                        router.push(`/reservations/${banner.reservationId}`)
                        dismiss(banner.notifId)
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {isStatusUpdate && <span className="mr-1.5">عرض التفاصيل</span>}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
