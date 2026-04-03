'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useReservation, useUpdateReservation } from '@/lib/hooks/use-reservations'
import { useGuests, useUpdateGuest } from '@/lib/hooks/use-guests'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { RESERVATION_STATUSES, RESERVATION_STATUS_COLORS } from '@/lib/constants'
import { ArrowRight, Paperclip, Link as LinkIcon, Utensils, Calendar, User, Home, DollarSign, FileText, Pencil, Save, X, Shield, Heart, Search, UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { CheckInOutActions } from '@/components/reservations/CheckInOutActions'
import { ReservationPrint } from '@/components/print/ReservationPrint'
import { PaymentTracker } from '@/components/payments/PaymentTracker'
import { LoyaltyCard } from '@/components/loyalty/LoyaltyCard'
import { ServiceQuickAdd } from '@/components/reservations/ServiceQuickAdd'
import { AttachmentsPreview } from '@/components/reservations/AttachmentsPreview'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { calculateReservationPrice } from '@/lib/utils/pricing'

const GUEST_TYPE_OPTIONS = [
  { value: 'military', label: 'عسكري' },
  { value: 'civilian', label: 'مدني' },
  { value: 'club_member', label: 'عضو دار' },
  { value: 'artillery_family', label: 'ابناء مدفعية' },
]

const MILITARY_RANKS = [
  { value: 'مشير', label: 'مشير' },
  { value: 'فريق أول', label: 'فريق أول' },
  { value: 'فريق', label: 'فريق' },
  { value: 'لواء', label: 'لواء' },
  { value: 'عميد', label: 'عميد' },
  { value: 'عقيد', label: 'عقيد' },
  { value: 'مقدم', label: 'مقدم' },
  { value: 'رائد', label: 'رائد' },
  { value: 'نقيب', label: 'نقيب' },
  { value: 'ملازم أول', label: 'ملازم أول' },
  { value: 'ملازم', label: 'ملازم' },
  { value: 'رقيب أول', label: 'رقيب أول' },
  { value: 'رقيب', label: 'رقيب' },
  { value: 'عريف', label: 'عريف' },
  { value: 'جندي أول', label: 'جندي أول' },
  { value: 'جندي', label: 'جندي' },
]

export default function ReservationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const isBranchManager = hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any)
  const id = params.id as string
  const { data: reservation, isLoading } = useReservation(id)
  const updateReservation = useUpdateReservation()
  const updateGuest = useUpdateGuest()

  // Notes editing state
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  // Guest editing state
  const [guestEditing, setGuestEditing] = useState(false)
  const [guestSaving, setGuestSaving] = useState(false)

  // Change guest state
  const [changeGuestOpen, setChangeGuestOpen] = useState(false)
  const [guestSearch, setGuestSearch] = useState('')
  const [changingGuest, setChangingGuest] = useState(false)
  const { data: allGuests } = useGuests(guestSearch)
  const [guestForm, setGuestForm] = useState({
    first_name_ar: '',
    last_name_ar: '',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    national_id: '',
    military_rank_ar: '',
    guest_type: 'military' as string,
  })

  // Sync notes from reservation data
  useEffect(() => {
    if (reservation) {
      setNotes(reservation.notes || '')
    }
  }, [reservation])

  // Sync guest form from reservation data
  useEffect(() => {
    if (reservation?.guest) {
      const g = reservation.guest
      setGuestForm({
        first_name_ar: g.first_name_ar || '',
        last_name_ar: g.last_name_ar || '',
        first_name: g.first_name || '',
        last_name: g.last_name || '',
        phone: g.phone || '',
        email: g.email || '',
        national_id: g.national_id || '',
        military_rank_ar: g.military_rank_ar || '',
        guest_type: g.guest_type || 'military',
      })
    }
  }, [reservation])

  async function handleStatusChange(status: string) {
    try {
      await updateReservation.mutateAsync({
        id,
        status: status as any,
      })
      toast({
        title: 'نجح',
        description: 'تم تحديث حالة الحجز',
      })
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في تحديث الحالة',
        variant: 'destructive',
      })
    }
  }

  async function handleSaveNotes() {
    setNotesSaving(true)
    try {
      await updateReservation.mutateAsync({
        id,
        notes: notes || undefined,
      })
      toast({ title: 'نجح', description: 'تم حفظ الملاحظات' })
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل في حفظ الملاحظات', variant: 'destructive' })
    } finally {
      setNotesSaving(false)
    }
  }

  async function recalculateAndUpdatePrice(guestType: string) {
    if (!reservation) return
    try {
      // Fetch active pricing data for this unit
      const { data: pricingData, error: pricingError } = await supabase
        .from('pricing')
        .select('*')
        .eq('unit_id', reservation.unit_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (pricingError) {
        console.error('Error fetching pricing:', pricingError)
      }

      const newTotal = await calculateReservationPrice(
        {
          unitId: reservation.unit_id,
          checkInDate: reservation.check_in_date,
          checkOutDate: reservation.check_out_date,
          unitType: reservation.unit?.type || 'room',
          guestType: guestType as any,
        },
        (pricingData || []) as any[]
      )

      await updateReservation.mutateAsync({
        id,
        total_amount: newTotal,
      })

      queryClient.invalidateQueries({ queryKey: ['reservation', id] })

      toast({
        title: 'تم تحديث السعر',
        description: `تم إعادة حساب السعر: ${formatCurrency(newTotal)}`,
      })
    } catch (error: any) {
      console.error('Error recalculating price:', error)
      toast({
        title: 'تحذير',
        description: 'تم تحديث البيانات لكن فشل في إعادة حساب السعر',
        variant: 'destructive',
      })
    }
  }

  async function handleSaveGuest() {
    if (!reservation?.guest?.id) return
    setGuestSaving(true)
    try {
      await updateGuest.mutateAsync({
        id: reservation.guest.id,
        first_name_ar: guestForm.first_name_ar || undefined,
        last_name_ar: guestForm.last_name_ar || undefined,
        first_name: guestForm.first_name,
        last_name: guestForm.last_name,
        phone: guestForm.phone,
        email: guestForm.email || undefined,
        national_id: guestForm.national_id || undefined,
        military_rank_ar: guestForm.military_rank_ar || undefined,
        guest_type: guestForm.guest_type as any,
      })
      // Refetch reservation to update the guest data shown
      queryClient.invalidateQueries({ queryKey: ['reservation', id] })
      toast({ title: 'نجح', description: 'تم تحديث بيانات الضيف' })

      // Recalculate price if guest type changed
      if (guestForm.guest_type !== reservation?.guest?.guest_type) {
        await recalculateAndUpdatePrice(guestForm.guest_type)
      }

      setGuestEditing(false)
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'فشل في تحديث بيانات الضيف', variant: 'destructive' })
    } finally {
      setGuestSaving(false)
    }
  }

  function handleCancelGuestEdit() {
    if (reservation?.guest) {
      const g = reservation.guest
      setGuestForm({
        first_name_ar: g.first_name_ar || '',
        last_name_ar: g.last_name_ar || '',
        first_name: g.first_name || '',
        last_name: g.last_name || '',
        phone: g.phone || '',
        email: g.email || '',
        national_id: g.national_id || '',
        military_rank_ar: g.military_rank_ar || '',
        guest_type: g.guest_type || 'military',
      })
    }
    setGuestEditing(false)
  }

  async function handleChangeGuest(newGuestId: string) {
    setChangingGuest(true)
    try {
      await updateReservation.mutateAsync({
        id,
        guest_id: newGuestId,
      })
      queryClient.invalidateQueries({ queryKey: ['reservation', id] })
      toast({ title: 'نجح', description: 'تم تغيير الضيف بنجاح' })

      // Recalculate price based on new guest's type
      const newGuest = allGuests?.find(g => g.id === newGuestId)
      if (newGuest?.guest_type) {
        await recalculateAndUpdatePrice(newGuest.guest_type)
      }

      setChangeGuestOpen(false)
      setGuestSearch('')
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message || 'فشل في تغيير الضيف', variant: 'destructive' })
    } finally {
      setChangingGuest(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-screen w-full" />
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <p className="text-muted-foreground text-lg">الحجز غير موجود</p>
        </motion.div>
      </div>
    )
  }

  const primaryImage = reservation.unit?.images?.find(img => img.is_primary) || reservation.unit?.images?.[0]
  const statusColor = RESERVATION_STATUS_COLORS[reservation.status as keyof typeof RESERVATION_STATUS_COLORS] || 'bg-gray-100 text-gray-800'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div className="flex-1 min-w-[300px]">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 mb-3"
          >
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            >
              <FileText className="h-8 w-8 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
                تفاصيل الحجز
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">{reservation.reservation_number}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                  {RESERVATION_STATUSES[reservation.status as keyof typeof RESERVATION_STATUSES]}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 flex-wrap"
        >
          <CheckInOutActions reservation={reservation} />
          <ReservationPrint reservation={reservation} />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href={`/reservations/${id}/attachments`}>
              <Button variant="outline" className="relative overflow-hidden group border-2 hover:border-primary transition-all">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
                <Paperclip className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">المرفقات</span>
              </Button>
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href={`/reservations/${id}/services`}>
              <Button variant="outline" className="relative overflow-hidden group border-2 hover:border-primary transition-all">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
                <Utensils className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">الخدمات والطعام</span>
              </Button>
            </Link>
          </motion.div>
          <ServiceQuickAdd reservationId={id} />
        </motion.div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Premium Reservation Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.01, y: -2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/20 to-transparent"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 2,
              }}
            />
            <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <Calendar className="h-6 w-6 text-blue-600" />
                </motion.div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  معلومات الحجز
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-4 space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <span className="text-muted-foreground font-medium">رقم الحجز:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{reservation.reservation_number}</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <span className="text-muted-foreground font-medium">الحالة:</span>
                <Select
                  value={reservation.status}
                  onValueChange={handleStatusChange}
                  disabled={isBranchManager}
                >
                  <SelectTrigger className="w-[180px] bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-primary/50 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESERVATION_STATUSES)
                      .filter(([value]) => !isBranchManager || value === 'pending' || value === 'cancelled')
                      .map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <span className="text-muted-foreground font-medium">تاريخ الدخول:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatDateShort(reservation.check_in_date)}</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <span className="text-muted-foreground font-medium">تاريخ الخروج:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatDateShort(reservation.check_out_date)}</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <span className="text-muted-foreground font-medium">المصدر:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{reservation.source}</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <span className="text-muted-foreground font-medium">عدد البالغين:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{reservation.adults}</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <span className="text-muted-foreground font-medium">عدد الأطفال:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{reservation.children}</span>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        <PaymentTracker reservation={reservation} />
        
        {reservation.guest_id && (
          <LoyaltyCard
            guestId={reservation.guest_id}
            reservationId={reservation.id}
          />
        )}

        {/* Premium Guest Info Card - Editable */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.01, y: -2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-rose-950/30 backdrop-blur-sm">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-200/20 to-transparent"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 2,
              }}
            />
            <CardHeader className="relative z-10 border-b border-purple-200/50 dark:border-purple-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{
                      rotate: [0, -360],
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    <User className="h-6 w-6 text-purple-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    معلومات الضيف
                  </CardTitle>
                </div>
                {!guestEditing ? (
                  <div className="flex gap-2 relative z-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGuestEditing(true)}
                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-100/50"
                    >
                      <Pencil className="h-4 w-4 ml-1" />
                      تعديل معلومات الضيف
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setChangeGuestOpen(true)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-100/50"
                    >
                      <UserPlus className="h-4 w-4 ml-1" />
                      تغيير الضيف
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 relative z-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelGuestEdit}
                      className="text-red-600 hover:text-red-700 hover:bg-red-100/50"
                    >
                      <X className="h-4 w-4 ml-1" />
                      إلغاء
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveGuest}
                      disabled={guestSaving}
                      className="text-green-600 hover:text-green-700 hover:bg-green-100/50"
                    >
                      <Save className="h-4 w-4 ml-1" />
                      {guestSaving ? 'جارٍ الحفظ...' : 'حفظ'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-4 space-y-4">
              {guestEditing ? (
                /* ====== EDIT MODE ====== */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">الاسم الأول (عربي)</Label>
                      <Input
                        value={guestForm.first_name_ar}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, first_name_ar: e.target.value }))}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                        dir="rtl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">الاسم الأخير (عربي)</Label>
                      <Input
                        value={guestForm.last_name_ar}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, last_name_ar: e.target.value }))}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                        dir="rtl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">First Name (English)</Label>
                      <Input
                        value={guestForm.first_name}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, first_name: e.target.value }))}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Last Name (English)</Label>
                      <Input
                        value={guestForm.last_name}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, last_name: e.target.value }))}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">الهاتف</Label>
                      <Input
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">البريد الإلكتروني</Label>
                      <Input
                        value={guestForm.email}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">الرقم القومي</Label>
                    <Input
                      value={guestForm.national_id}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, national_id: e.target.value }))}
                      className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">نوع الضيف</Label>
                    <Select
                      value={guestForm.guest_type}
                      onValueChange={(val) => setGuestForm(prev => ({ ...prev, guest_type: val }))}
                    >
                      <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GUEST_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {guestForm.guest_type === 'military' && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">الرتبة العسكرية</Label>
                      <Select
                        value={guestForm.military_rank_ar}
                        onValueChange={(val) => setGuestForm(prev => ({ ...prev, military_rank_ar: val }))}
                      >
                        <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all">
                          <SelectValue placeholder="اختر الرتبة" />
                        </SelectTrigger>
                        <SelectContent>
                          {MILITARY_RANKS.map(rank => (
                            <SelectItem key={rank.value} value={rank.value}>{rank.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ) : (
                /* ====== VIEW MODE ====== */
                <>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-800/50"
                  >
                    <span className="text-muted-foreground font-medium block mb-1">الاسم:</span>
                    <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
                      {reservation.guest?.first_name_ar || reservation.guest?.first_name}{' '}
                      {reservation.guest?.last_name_ar || reservation.guest?.last_name}
                    </p>
                  </motion.div>
                  {reservation.guest?.phone && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-800/50"
                    >
                      <span className="text-muted-foreground font-medium block mb-1">الهاتف:</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{reservation.guest.phone}</p>
                    </motion.div>
                  )}
                  {reservation.guest?.email && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 }}
                      className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-800/50"
                    >
                      <span className="text-muted-foreground font-medium block mb-1">البريد:</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{reservation.guest.email}</p>
                    </motion.div>
                  )}
                  {reservation.guest?.national_id && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.75 }}
                      className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-800/50"
                    >
                      <span className="text-muted-foreground font-medium block mb-1">الرقم القومي:</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{reservation.guest.national_id}</p>
                    </motion.div>
                  )}
                  {reservation.guest?.military_rank_ar && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 }}
                      className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-800/50"
                    >
                      <span className="text-muted-foreground font-medium block mb-1">الرتبة:</span>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{reservation.guest.military_rank_ar}</p>
                    </motion.div>
                  )}
                  {reservation.guest?.guest_type && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 }}
                      className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-800/50"
                    >
                      <span className="text-muted-foreground font-medium block mb-1">نوع الضيف:</span>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                        reservation.guest.guest_type === 'military' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        reservation.guest.guest_type === 'club_member' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                        reservation.guest.guest_type === 'artillery_family' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {reservation.guest.guest_type === 'military' ? 'عسكري' :
                         reservation.guest.guest_type === 'club_member' ? 'عضو دار' :
                         reservation.guest.guest_type === 'artillery_family' ? 'ابناء مدفعية' : 'مدني'}
                      </span>
                    </motion.div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Change Guest Dialog */}
        <Dialog open={changeGuestOpen} onOpenChange={(open) => { setChangeGuestOpen(open); if (!open) setGuestSearch('') }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:via-blue-950/20 dark:to-indigo-950/20 backdrop-blur-xl" dir="rtl">
            <DialogHeader className="border-b border-blue-200/50 dark:border-blue-800/50 pb-4">
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                تغيير الضيف
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الهاتف أو البريد..."
                  className="pr-10 bg-white/70 dark:bg-slate-800/70 border-2 hover:border-blue-400 transition-all"
                  dir="rtl"
                />
              </div>
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                {allGuests && allGuests.length > 0 ? allGuests.map((g) => (
                  <button
                    key={g.id}
                    disabled={changingGuest || g.id === reservation?.guest_id}
                    onClick={() => handleChangeGuest(g.id)}
                    className={`w-full text-right p-3 rounded-lg border transition-all ${
                      g.id === reservation?.guest_id
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {g.first_name_ar || g.first_name} {g.last_name_ar || g.last_name}
                          {g.id === reservation?.guest_id && <span className="text-xs text-blue-500 mr-2">(الضيف الحالي)</span>}
                        </p>
                        <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                          {g.phone && <span>📞 {g.phone}</span>}
                          {g.guest_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              {GUEST_TYPE_OPTIONS.find(o => o.value === g.guest_type)?.label || g.guest_type}
                            </span>
                          )}
                        </div>
                      </div>
                      {g.id !== reservation?.guest_id && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                )) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {guestSearch ? 'لا توجد نتائج' : 'ابدأ بالبحث عن ضيف...'}
                  </div>
                )}
                {changingGuest && (
                  <div className="text-center py-4 text-blue-600 font-medium">جارٍ تغيير الضيف...</div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Premium Unit Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.01, y: -2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/30 dark:via-emerald-950/30 dark:to-teal-950/30 backdrop-blur-sm">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-green-200/20 to-transparent"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 2,
              }}
            />
            <CardHeader className="relative z-10 border-b border-green-200/50 dark:border-green-800/50">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <Home className="h-6 w-6 text-green-600" />
                </motion.div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  معلومات الوحدة
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-4 space-y-4">
              {primaryImage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.02 }}
                  className="relative h-56 w-full rounded-xl overflow-hidden mb-4 border-2 border-green-200/50 dark:border-green-800/50 shadow-lg"
                >
                  <Image
                    src={primaryImage.image_url}
                    alt={reservation.unit?.name_ar || ''}
                    fill
                    className="object-cover"
                  />
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-800/50"
              >
                <span className="text-muted-foreground font-medium block mb-1">رقم الوحدة:</span>
                <p className="font-bold text-slate-900 dark:text-slate-100">{reservation.unit?.unit_number}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-800/50"
              >
                <span className="text-muted-foreground font-medium block mb-1">الاسم:</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{reservation.unit?.name_ar || reservation.unit?.name}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 }}
                className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-800/50"
              >
                <span className="text-muted-foreground font-medium block mb-1">النوع:</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{reservation.unit?.type}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 }}
                className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-800/50"
              >
                <span className="text-muted-foreground font-medium block mb-1">السعة:</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{reservation.unit?.capacity} أشخاص</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outline"
                  onClick={() => router.push(`/units/${reservation.unit_id}`)}
                  className="w-full relative overflow-hidden group border-2 hover:border-green-500 transition-all bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-green-200/20 to-transparent"
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                  <span className="relative z-10 font-semibold">عرض تفاصيل الوحدة</span>
                  <ArrowRight className="mr-2 h-4 w-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notes Card - Always Visible & Editable */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="md:col-span-2"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/30 dark:via-yellow-950/30 dark:to-orange-950/30 backdrop-blur-sm">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 2,
              }}
            />
            <CardHeader className="relative z-10 border-b border-amber-200/50 dark:border-amber-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{
                      rotate: [0, -360],
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    <FileText className="h-6 w-6 text-amber-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    ملاحظات
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={notesSaving}
                  className="relative z-10 text-amber-600 hover:text-amber-700 hover:bg-amber-100/50"
                >
                  <Save className="h-4 w-4 ml-1" />
                  {notesSaving ? 'جارٍ الحفظ...' : 'حفظ'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">ملاحظات</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-amber-400 transition-all resize-none"
                  placeholder="أضف ملاحظات..."
                  dir="rtl"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <AttachmentsPreview reservationId={reservation.id} />
    </div>
  )
}
