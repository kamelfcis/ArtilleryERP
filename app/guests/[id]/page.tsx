'use client'

import { useParams, useRouter } from 'next/navigation'
import { useGuest } from '@/lib/hooks/use-guests'
import { useReservations } from '@/lib/hooks/use-reservations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { RESERVATION_STATUSES, RESERVATION_STATUS_COLORS } from '@/lib/constants'
import { 
  Edit, ArrowRight, User, Phone, Mail, CreditCard, Shield, Building2, 
  Calendar, DollarSign, CheckCircle, Clock, TrendingUp, Award, Star,
  FileText, Users, Hash
} from 'lucide-react'
import Link from 'next/link'
import { GuestPreferences } from '@/components/guests/GuestPreferences'
import { LoyaltyCard } from '@/components/loyalty/LoyaltyCard'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function GuestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: guest, isLoading: guestLoading } = useGuest(id)
  const { data: reservations, isLoading: reservationsLoading } = useReservations()

  const guestReservations = reservations?.filter(r => r.guest_id === id) || []
  const confirmedReservations = guestReservations.filter(r => r.status === 'confirmed' || r.status === 'checked_in' || r.status === 'checked_out')
  const totalSpent = guestReservations.reduce((sum, r) => sum + (r.total_amount || 0), 0)

  if (guestLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!guest) {
    return (
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <p className="text-muted-foreground text-lg">الضيف غير موجود</p>
        </motion.div>
      </div>
    )
  }

  const guestTypeLabel = guest.guest_type === 'military' ? 'عسكري' :
    guest.guest_type === 'civilian' ? 'مدني' :
    guest.guest_type === 'club_member' ? 'عضو دار' :
    guest.guest_type === 'artillery_family' ? 'ابناء مدفعية' : 'مدني'

  const guestTypeColor = guest.guest_type === 'military' ? 'from-blue-500 to-indigo-600' :
    guest.guest_type === 'club_member' ? 'from-purple-500 to-violet-600' :
    guest.guest_type === 'artillery_family' ? 'from-red-500 to-rose-600' :
    'from-green-500 to-emerald-600'

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
              className={`p-3 rounded-xl bg-gradient-to-br ${guestTypeColor} shadow-lg`}
              animate={{
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 2,
              }}
            >
              <User className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
                {guest.first_name_ar || guest.first_name} {guest.last_name_ar || guest.last_name}
              </h1>
              <div className="flex items-center gap-3">
                {guest.military_rank_ar && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {guest.military_rank_ar}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${guestTypeColor} text-white`}>
                  {guestTypeLabel}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="relative overflow-hidden group border-2 hover:border-primary transition-all"
            >
              <ArrowRight className="ml-2 h-4 w-4 relative z-10" />
              <span className="relative z-10">رجوع</span>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href={`/guests/${id}/edit`}>
              <Button className="relative overflow-hidden group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
                <Edit className="ml-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">تعديل</span>
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">إجمالي الحجوزات</p>
                  <p className="text-2xl font-bold text-white">{guestReservations.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-white/80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-green-500 to-emerald-600">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">الحجوزات المؤكدة</p>
                  <p className="text-2xl font-bold text-white">{confirmedReservations.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-white/80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-violet-600">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">إجمالي الإنفاق</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(totalSpent)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-white/80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">تاريخ الانضمام</p>
                  <p className="text-lg font-bold text-white">{formatDateShort(guest.created_at)}</p>
                </div>
                <Star className="h-8 w-8 text-white/80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Guest Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.01, y: -2 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm h-full">
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
                  className="p-2 rounded-lg bg-blue-500/10"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  <User className="h-5 w-5 text-blue-600" />
                </motion.div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  معلومات الضيف
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-4 space-y-3">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground font-medium">الاسم الكامل:</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {guest.first_name_ar || guest.first_name} {guest.last_name_ar || guest.last_name}
                </span>
              </motion.div>

              {guest.phone && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground font-medium">الهاتف:</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{guest.phone}</span>
                </motion.div>
              )}

              {guest.email && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-purple-500" />
                    <span className="text-muted-foreground font-medium">البريد:</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{guest.email}</span>
                </motion.div>
              )}

              {guest.national_id && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-orange-500" />
                    <span className="text-muted-foreground font-medium">الهوية الوطنية:</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{guest.national_id}</span>
                </motion.div>
              )}

              {guest.military_rank_ar && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground font-medium">الرتبة:</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{guest.military_rank_ar}</span>
                </motion.div>
              )}

              {guest.unit_ar && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-teal-500" />
                    <span className="text-muted-foreground font-medium">الوحدة:</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{guest.unit_ar}</span>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <span className="text-muted-foreground font-medium">نوع الضيف:</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${guestTypeColor} text-white`}>
                  {guestTypeLabel}
                </span>
              </motion.div>

              {guest.notes && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 }}
                  className="p-4 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground font-medium">ملاحظات:</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{guest.notes}</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Loyalty Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <LoyaltyCard guestId={guest.id} />
        </motion.div>

        {/* Reservations History Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="md:col-span-2"
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
                  className="p-2 rounded-lg bg-green-500/10"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  <Calendar className="h-5 w-5 text-green-600" />
                </motion.div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  سجل الحجوزات
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-4">
              {reservationsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : guestReservations.length > 0 ? (
                <div className="space-y-3">
                  {guestReservations.map((reservation, index) => (
                    <motion.div
                      key={reservation.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                    >
                      <Link
                        href={`/reservations/${reservation.id}`}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-800/50 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-all hover:shadow-lg group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-colors">
                            <Hash className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{reservation.reservation_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {reservation.unit?.unit_number} - {reservation.unit?.name_ar || reservation.unit?.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {formatDateShort(reservation.check_in_date)} - {formatDateShort(reservation.check_out_date)}
                            </p>
                            <p className="text-sm font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(reservation.total_amount)}
                            </p>
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-semibold",
                            RESERVATION_STATUS_COLORS[reservation.status as keyof typeof RESERVATION_STATUS_COLORS]
                          )}>
                            {RESERVATION_STATUSES[reservation.status as keyof typeof RESERVATION_STATUSES]}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                    <Calendar className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-muted-foreground">لا توجد حجوزات</p>
                  <p className="text-sm text-muted-foreground mt-2">لم يقم هذا الضيف بأي حجوزات بعد</p>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Guest Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="md:col-span-2"
        >
          <GuestPreferences guest={guest} />
        </motion.div>
      </div>
    </div>
  )
}
