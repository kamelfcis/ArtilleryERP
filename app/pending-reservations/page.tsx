'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useUpdateReservation } from '@/lib/hooks/use-reservations'
import {
  useBookingNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useCreateBookingNotification,
} from '@/lib/hooks/use-booking-notifications'
import { useAuth } from '@/contexts/AuthContext'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { RESERVATION_STATUSES, RESERVATION_STATUS_COLORS } from '@/lib/constants'
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Home,
  Calendar,
  DollarSign,
  Eye,
  CheckCheck,
  FileText,
  ArrowRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface PendingReservation {
  id: string
  reservation_number: string
  status: string
  check_in_date: string
  check_out_date: string
  total_amount: number
  paid_amount: number
  discount_amount: number
  adults: number
  children: number
  notes: string | null
  source: string
  created_by: string
  created_at: string
  guest: {
    id: string
    first_name: string
    last_name: string
    first_name_ar: string
    last_name_ar: string
    phone: string
    email: string
  }
  unit: {
    id: string
    unit_number: string
    name: string
    location: {
      name: string
      name_ar: string
    }
  }
}

export default function PendingReservationsPage() {
  const queryClient = useQueryClient()
  const { user, hasRole, elevatedOps } = useAuth()
  const restrictedBranchManager =
    hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
  const updateReservation = useUpdateReservation()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const createNotification = useCreateBookingNotification()
  const { data: bookingNotifs } = useBookingNotifications()
  const [selectedReservation, setSelectedReservation] = useState<PendingReservation | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: pendingReservations, isLoading } = useQuery({
    queryKey: ['pending-reservations', restrictedBranchManager ? user?.id : 'all'],
    queryFn: async () => {
      let query = supabase
        .from('reservations')
        .select(`
          *,
          guest:guests(id, first_name, last_name, first_name_ar, last_name_ar, phone, email),
          unit:units(id, unit_number, name, location:locations(name, name_ar))
        `)

      if (restrictedBranchManager) {
        query = query.eq('created_by', user?.id ?? '')
      } else {
        query = query.eq('status', 'pending')
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as PendingReservation[]
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const { data: authUsers } = useQuery({
    queryKey: ['admin-users-for-pending'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      return json.users as { id: string; email: string }[]
    },
  })

  const userEmailById = new Map<string, string>()
  authUsers?.forEach(u => userEmailById.set(u.id, u.email))

  function sendReverseNotification(res: PendingReservation, newStatus: 'confirmed' | 'cancelled') {
    if (!user?.id || !res.created_by) return
    const gName = guestName(res.guest)
    const unitInfo = `${res.unit?.unit_number} — ${res.unit?.location?.name_ar || res.unit?.location?.name}`
    const statusLabel = newStatus === 'confirmed' ? 'تم تأكيد' : 'تم رفض'
    const statusIcon = newStatus === 'confirmed' ? '✅' : '❌'
    createNotification.mutate({
      reservation_id: res.id,
      created_by: user.id,
      notify_user_id: res.created_by,
      message: `${statusIcon} ${statusLabel} حجزك | الضيف: ${gName} | الوحدة: ${unitInfo} | ${res.check_in_date} إلى ${res.check_out_date} | المبلغ: ${res.total_amount} ج.م`,
    })
  }

  async function handleConfirm(id: string) {
    try {
      await updateReservation.mutateAsync({ id, status: 'confirmed' as any })
      const notif = bookingNotifs?.find(n => n.reservation_id === id && !n.is_read)
      if (notif) markRead.mutate(notif.id)
      const res = pendingReservations?.find(r => r.id === id)
      if (res) sendReverseNotification(res, 'confirmed')
      queryClient.invalidateQueries({ queryKey: ['pending-reservations'] })
      toast({ title: 'تم تأكيد الحجز بنجاح' })
    } catch (e: any) {
      toast({ title: 'فشل في تأكيد الحجز', description: e.message, variant: 'destructive' })
    }
  }

  async function handleReject(id: string) {
    try {
      await updateReservation.mutateAsync({ id, status: 'cancelled' as any })
      const notif = bookingNotifs?.find(n => n.reservation_id === id && !n.is_read)
      if (notif) markRead.mutate(notif.id)
      const res = pendingReservations?.find(r => r.id === id)
      if (res) sendReverseNotification(res, 'cancelled')
      queryClient.invalidateQueries({ queryKey: ['pending-reservations'] })
      toast({ title: 'تم رفض الحجز' })
    } catch (e: any) {
      toast({ title: 'فشل في رفض الحجز', description: e.message, variant: 'destructive' })
    }
  }

  function openDetail(reservation: PendingReservation) {
    setSelectedReservation(reservation)
    setDetailOpen(true)
    const notif = bookingNotifs?.find(n => n.reservation_id === reservation.id && !n.is_read)
    if (notif) markRead.mutate(notif.id)
  }

  function guestName(g: PendingReservation['guest']) {
    return `${g.first_name_ar || g.first_name} ${g.last_name_ar || g.last_name}`.trim()
  }

  function daysBetween(a: string, b: string) {
    return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff'] as any}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              طلبات الحجز
            </h1>
            <p className="text-muted-foreground mt-1">
              {restrictedBranchManager ? 'متابعة حالة طلبات الحجز الخاصة بك' : 'حجوزات بانتظار الموافقة من مدراء الفروع'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(bookingNotifs?.filter(n => !n.is_read).length ?? 0) > 0 && (
              <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
                <CheckCheck className="h-4 w-4 ml-2" />
                قراءة كل الإشعارات
              </Button>
            )}
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Clock className="h-4 w-4 ml-1" />
              {pendingReservations?.length ?? 0} حجز معلق
            </Badge>
          </div>
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-72" />
                    </div>
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!pendingReservations || pendingReservations.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{restrictedBranchManager ? 'لا توجد طلبات حجز' : 'لا توجد حجوزات معلقة'}</h3>
              <p className="text-muted-foreground">{restrictedBranchManager ? 'لم تقم بإرسال أي طلبات حجز بعد' : 'تم مراجعة جميع الحجوزات'}</p>
            </CardContent>
          </Card>
        )}

        {/* Reservation cards */}
        <div className="grid gap-4">
          {pendingReservations?.map((res, index) => {
            const isUnread = bookingNotifs?.some(n => n.reservation_id === res.id && !n.is_read)
            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`hover:shadow-lg transition-all duration-200 ${
                  isUnread ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20' : ''
                }`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={
                            res.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            res.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            res.status === 'checked_in' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }>
                            {res.status === 'confirmed' ? <CheckCircle className="h-3 w-3 ml-1" /> :
                             res.status === 'cancelled' ? <XCircle className="h-3 w-3 ml-1" /> :
                             <Clock className="h-3 w-3 ml-1" />}
                            {RESERVATION_STATUSES[res.status as keyof typeof RESERVATION_STATUSES] || res.status}
                          </Badge>
                          <span className="font-mono text-sm font-semibold text-muted-foreground">{res.reservation_number}</span>
                          {isUnread && (
                            <span className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate font-medium">{guestName(res.guest)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">
                              {res.unit?.unit_number} — {res.unit?.location?.name_ar || res.unit?.location?.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>
                              {formatDateShort(res.check_in_date)} → {formatDateShort(res.check_out_date)}
                              <span className="text-muted-foreground mr-1">({daysBetween(res.check_in_date, res.check_out_date)} ليلة)</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-semibold">{formatCurrency(res.total_amount)}</span>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2">
                          بواسطة: {userEmailById.get(res.created_by) || res.created_by?.substring(0, 8) + '...'}
                          {' · '}
                          {formatDateShort(res.created_at)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetail(res)}
                        >
                          <Eye className="h-4 w-4 ml-1" />
                          التفاصيل
                        </Button>
                        {!restrictedBranchManager && res.status === 'pending' && (
                        <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleConfirm(res.id)}
                          disabled={updateReservation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 ml-1" />
                          تأكيد
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(res.id)}
                          disabled={updateReservation.isPending}
                        >
                          <XCircle className="h-4 w-4 ml-1" />
                          رفض
                        </Button>
                        </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-orange-500" />
                تفاصيل الحجز — {selectedReservation?.reservation_number}
              </DialogTitle>
            </DialogHeader>
            {selectedReservation && (
              <div className="space-y-6">
                {/* Guest info */}
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" /> بيانات الضيف
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">الاسم:</span>
                      <span className="font-medium mr-2">{guestName(selectedReservation.guest)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الهاتف:</span>
                      <span className="font-medium mr-2 direction-ltr">{selectedReservation.guest.phone}</span>
                    </div>
                    {selectedReservation.guest.email && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">البريد:</span>
                        <span className="font-medium mr-2">{selectedReservation.guest.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Unit info */}
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Home className="h-4 w-4" /> بيانات الوحدة
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">الوحدة:</span>
                      <span className="font-medium mr-2">{selectedReservation.unit?.unit_number} — {selectedReservation.unit?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الموقع:</span>
                      <span className="font-medium mr-2">{selectedReservation.unit?.location?.name_ar || selectedReservation.unit?.location?.name}</span>
                    </div>
                  </div>
                </div>

                {/* Reservation details */}
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> تفاصيل الحجز
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">تاريخ الدخول:</span>
                      <span className="font-medium mr-2">{formatDateShort(selectedReservation.check_in_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">تاريخ الخروج:</span>
                      <span className="font-medium mr-2">{formatDateShort(selectedReservation.check_out_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">عدد الليالي:</span>
                      <span className="font-medium mr-2">{daysBetween(selectedReservation.check_in_date, selectedReservation.check_out_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">البالغين / الأطفال:</span>
                      <span className="font-medium mr-2">{selectedReservation.adults} / {selectedReservation.children}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                      <span className="font-bold mr-2 text-green-600">{formatCurrency(selectedReservation.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المصدر:</span>
                      <span className="font-medium mr-2">{selectedReservation.source}</span>
                    </div>
                  </div>
                  {selectedReservation.notes && (
                    <div className="mt-2">
                      <span className="text-muted-foreground text-sm">ملاحظات:</span>
                      <p className="text-sm mt-1 bg-muted/50 rounded-lg p-3">{selectedReservation.notes}</p>
                    </div>
                  )}
                </div>

                {/* Creator info */}
                <div className="text-xs text-muted-foreground border-t pt-3">
                  تم الإنشاء بواسطة: {userEmailById.get(selectedReservation.created_by) || selectedReservation.created_by}
                  {' · '}
                  {formatDateShort(selectedReservation.created_at)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => { handleConfirm(selectedReservation.id); setDetailOpen(false) }}
                    disabled={updateReservation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 ml-2" />
                    تأكيد الحجز
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => { handleReject(selectedReservation.id); setDetailOpen(false) }}
                    disabled={updateReservation.isPending}
                  >
                    <XCircle className="h-4 w-4 ml-2" />
                    رفض الحجز
                  </Button>
                  <Link href={`/reservations/${selectedReservation.id}`}>
                    <Button variant="outline" size="icon">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  )
}
