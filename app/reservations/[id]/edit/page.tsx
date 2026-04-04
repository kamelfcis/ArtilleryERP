'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reservationSchema, type ReservationFormData } from '@/lib/validations/reservation'
import { useReservation, useUpdateReservation } from '@/lib/hooks/use-reservations'
import { useUnits } from '@/lib/hooks/use-units'
import { useGuests } from '@/lib/hooks/use-guests'
import { useLocations } from '@/lib/hooks/use-locations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Calendar, User, Home, DollarSign, FileText, Edit, ArrowRight, Save, X, MapPin, Users, CreditCard, Percent, Receipt } from 'lucide-react'
import { GuestForm } from '@/components/forms/GuestForm'
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { usePricing } from '@/lib/hooks/use-pricing'
import { calculateReservationPrice } from '@/lib/utils/pricing'
import Image from 'next/image'
import Link from 'next/link'
import { RESERVATION_STATUSES, RESERVATION_STATUS_COLORS, RESERVATION_SOURCES } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'

export default function EditReservationPage() {
  const params = useParams()
  const router = useRouter()
  const { hasRole, elevatedOps } = useAuth()
  const restrictedBranchManager =
    hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
  const id = params.id as string
  const { data: reservation, isLoading } = useReservation(id)
  const updateReservation = useUpdateReservation()
  const { data: locations } = useLocations()
  const { data: units } = useUnits()
  const { data: guests } = useGuests()
  const { data: pricingData } = usePricing({ isActive: true })
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
  })

  useEffect(() => {
    if (reservation) {
      reset({
        unit_id: reservation.unit_id,
        guest_id: reservation.guest_id,
        check_in_date: reservation.check_in_date,
        check_out_date: reservation.check_out_date,
        status: reservation.status,
        source: reservation.source,
        adults: reservation.adults,
        children: reservation.children,
        total_amount: reservation.total_amount,
        paid_amount: reservation.paid_amount,
        discount_amount: reservation.discount_amount,
        notes: reservation.notes,
        notes_ar: reservation.notes_ar,
      })
      if (reservation.unit?.location_id) {
        setSelectedLocation(reservation.unit.location_id)
      }
    }
  }, [reservation, reset])

  const filteredUnits = units?.filter(u => 
    !selectedLocation || u.location_id === selectedLocation
  )

  const watchedUnitId = watch('unit_id')
  const selectedUnit = units?.find(u => u.id === watchedUnitId)
  const primaryImage = selectedUnit?.images?.find((img: any) => img.is_primary) || selectedUnit?.images?.[0]

  async function onSubmit(data: ReservationFormData) {
    try {
      await updateReservation.mutateAsync({
        id,
        ...data,
      })
      toast({
        title: 'نجح',
        description: 'تم تحديث الحجز بنجاح',
      })
      router.push(`/reservations/${id}`)
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث الحجز',
        variant: 'destructive',
      })
    }
  }

  const calculateTotal = useCallback(async () => {
    const checkIn = watch('check_in_date')
    const checkOut = watch('check_out_date')
    const unitId = watch('unit_id')
    const guestId = watch('guest_id')
    
    if (!checkIn || !checkOut || !unitId) return 0

    const unit = units?.find(u => u.id === unitId)
    if (!unit) return 0

    // Find guest type for pricing calculation
    const guest = guests?.find(g => g.id === guestId)
    const guestType = guest?.guest_type || 'civilian'

    // Use real pricing data from the pricing table
    const total = await calculateReservationPrice(
      {
        unitId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        unitType: unit.type,
        guestType,
      },
      (pricingData || [])
    )

    return total
  }, [watch, units, guests, pricingData])

  // Calculate nights
  const checkInDate = watch('check_in_date')
  const checkOutDate = watch('check_out_date')
  const nights = checkInDate && checkOutDate 
    ? Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // Calculate remaining amount
  const totalAmount = watch('total_amount') || 0
  const paidAmount = watch('paid_amount') || 0
  const discountAmount = watch('discount_amount') || 0
  const remainingAmount = totalAmount - paidAmount - discountAmount

  if (isLoading) {
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
              <Edit className="h-8 w-8 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
                تعديل الحجز
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
          className="flex gap-2"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href={`/reservations/${id}`}>
              <Button variant="outline" className="relative overflow-hidden group border-2 hover:border-primary transition-all">
                <ArrowRight className="ml-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">العودة للتفاصيل</span>
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Summary Cards */}
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
                  <p className="text-blue-100 text-sm">عدد الليالي</p>
                  <p className="text-2xl font-bold text-white">{nights}</p>
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
                  <p className="text-green-100 text-sm">المبلغ الإجمالي</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(totalAmount)}</p>
                </div>
                <Receipt className="h-8 w-8 text-white/80" />
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
                  <p className="text-purple-100 text-sm">المدفوع</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(paidAmount)}</p>
                </div>
                <CreditCard className="h-8 w-8 text-white/80" />
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
          <Card className={cn(
            "relative overflow-hidden border-0 shadow-lg",
            remainingAmount > 0 
              ? "bg-gradient-to-br from-orange-500 to-red-600" 
              : "bg-gradient-to-br from-teal-500 to-cyan-600"
          )}>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-sm", remainingAmount > 0 ? "text-orange-100" : "text-teal-100")}>
                    المتبقي
                  </p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(remainingAmount)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-white/80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Reservation Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm h-full">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 rounded-lg bg-blue-500/10"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    معلومات الحجز
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-2 font-medium">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      الموقع
                    </Label>
                    <Select
                      value={selectedLocation}
                      onValueChange={setSelectedLocation}
                    >
                      <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-blue-400 transition-all">
                        <SelectValue placeholder="اختر الموقع" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations?.map(location => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name_ar || location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit_id" className="flex items-center gap-2 font-medium">
                      <Home className="h-4 w-4 text-green-500" />
                      الوحدة *
                    </Label>
                    <Select
                      value={watch('unit_id')}
                      onValueChange={(value) => setValue('unit_id', value)}
                    >
                      <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-green-400 transition-all">
                        <SelectValue placeholder="اختر الوحدة" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredUnits?.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.unit_number} - {unit.name_ar || unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.unit_id && (
                      <p className="text-sm text-destructive">{errors.unit_id.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="check_in_date" className="font-medium">تاريخ الدخول *</Label>
                    <Input
                      id="check_in_date"
                      type="date"
                      {...register('check_in_date')}
                      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-blue-400 transition-all"
                    />
                    {errors.check_in_date && (
                      <p className="text-sm text-destructive">{errors.check_in_date.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="check_out_date" className="font-medium">تاريخ الخروج *</Label>
                    <Input
                      id="check_out_date"
                      type="date"
                      {...register('check_out_date')}
                      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-blue-400 transition-all"
                    />
                    {errors.check_out_date && (
                      <p className="text-sm text-destructive">{errors.check_out_date.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status" className="font-medium">الحالة</Label>
                    <Select
                      value={watch('status')}
                      onValueChange={(value) => setValue('status', value as any)}
                      disabled={restrictedBranchManager}
                    >
                      <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-blue-400 transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RESERVATION_STATUSES)
                          .filter(([value]) => !restrictedBranchManager || value === 'pending' || value === 'cancelled')
                          .map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="source" className="font-medium">المصدر</Label>
                    <Select
                      value={watch('source') || 'direct'}
                      onValueChange={(value) => setValue('source', value as 'email' | 'phone' | 'online' | 'walk_in')}
                    >
                      <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-blue-400 transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RESERVATION_SOURCES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adults" className="flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4 text-purple-500" />
                      عدد البالغين *
                    </Label>
                    <Input
                      id="adults"
                      type="number"
                      min="1"
                      {...register('adults', { valueAsNumber: true })}
                      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-purple-400 transition-all"
                    />
                    {errors.adults && (
                      <p className="text-sm text-destructive">{errors.adults.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="children" className="flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4 text-pink-500" />
                      عدد الأطفال
                    </Label>
                    <Input
                      id="children"
                      type="number"
                      min="0"
                      {...register('children', { valueAsNumber: true })}
                      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-pink-400 transition-all"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Guest Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-rose-950/30 backdrop-blur-sm h-full">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              <CardHeader className="relative z-10 border-b border-purple-200/50 dark:border-purple-800/50">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 rounded-lg bg-purple-500/10"
                    animate={{ rotate: [0, -360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <User className="h-5 w-5 text-purple-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    معلومات الضيف
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guest_id" className="font-medium">الضيف *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={watch('guest_id')}
                      onValueChange={(value) => setValue('guest_id', value)}
                    >
                      <SelectTrigger className="flex-1 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-purple-400 transition-all">
                        <SelectValue placeholder="اختر الضيف" />
                      </SelectTrigger>
                      <SelectContent>
                        {guests?.map(guest => (
                          <SelectItem key={guest.id} value={guest.id}>
                            {guest.first_name_ar || guest.first_name} {guest.last_name_ar || guest.last_name}
                            {guest.phone && ` - ${guest.phone}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" className="border-2 hover:border-purple-400 transition-all">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>إضافة ضيف جديد</DialogTitle>
                        </DialogHeader>
                        <GuestForm
                          onSuccess={(guest) => {
                            setValue('guest_id', guest.id)
                            setGuestDialogOpen(false)
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                  {errors.guest_id && (
                    <p className="text-sm text-destructive">{errors.guest_id.message}</p>
                  )}
                </div>

                {/* Guest Preview */}
                {reservation.guest && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-800/50"
                  >
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3">الضيف الحالي:</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">الاسم:</span> <span className="font-medium">{reservation.guest.first_name_ar || reservation.guest.first_name} {reservation.guest.last_name_ar || reservation.guest.last_name}</span></p>
                      {reservation.guest.phone && (
                        <p><span className="text-muted-foreground">الهاتف:</span> <span className="font-medium">{reservation.guest.phone}</span></p>
                      )}
                      {reservation.guest.email && (
                        <p><span className="text-muted-foreground">البريد:</span> <span className="font-medium">{reservation.guest.email}</span></p>
                      )}
                      {reservation.guest.military_rank_ar && (
                        <p><span className="text-muted-foreground">الرتبة:</span> <span className="font-medium">{reservation.guest.military_rank_ar}</span></p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Unit Preview */}
                {selectedUnit && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-purple-200/50 dark:border-purple-800/50"
                  >
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3">الوحدة المختارة:</h4>
                    {primaryImage && (
                      <div className="relative h-32 w-full rounded-lg overflow-hidden mb-3">
                        <Image
                          src={primaryImage.image_url}
                          alt={selectedUnit.name_ar || selectedUnit.name || ''}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">رقم الوحدة:</span> <span className="font-medium">{selectedUnit.unit_number}</span></p>
                      <p><span className="text-muted-foreground">الاسم:</span> <span className="font-medium">{selectedUnit.name_ar || selectedUnit.name}</span></p>
                      <p><span className="text-muted-foreground">النوع:</span> <span className="font-medium">{selectedUnit.type}</span></p>
                      <p><span className="text-muted-foreground">السعة:</span> <span className="font-medium">{selectedUnit.capacity} أشخاص</span></p>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Financial Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/30 dark:via-emerald-950/30 dark:to-teal-950/30 backdrop-blur-sm h-full">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              <CardHeader className="relative z-10 border-b border-green-200/50 dark:border-green-800/50">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 rounded-lg bg-green-500/10"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    المعلومات المالية
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_amount" className="flex items-center gap-2 font-medium">
                      <Receipt className="h-4 w-4 text-green-500" />
                      المبلغ الإجمالي *
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="total_amount"
                        type="number"
                        min="0"
                        step="0.01"
                        {...register('total_amount', { valueAsNumber: true })}
                        className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-green-400 transition-all"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const total = await calculateTotal()
                          if (total > 0) {
                            setValue('total_amount', total)
                            toast({
                              title: 'تم الحساب',
                              description: `المبلغ الإجمالي: ${formatCurrency(total)}`,
                            })
                          } else {
                            toast({
                              title: 'تنبيه',
                              description: 'يرجى تحديد الوحدة وتواريخ الدخول والخروج أولاً',
                              variant: 'destructive',
                            })
                          }
                        }}
                        className="whitespace-nowrap border-2 hover:border-green-400 transition-all"
                      >
                        حساب تلقائي
                      </Button>
                    </div>
                    {errors.total_amount && (
                      <p className="text-sm text-destructive">{errors.total_amount.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paid_amount" className="flex items-center gap-2 font-medium">
                      <CreditCard className="h-4 w-4 text-purple-500" />
                      المبلغ المدفوع
                    </Label>
                    <Input
                      id="paid_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register('paid_amount', { valueAsNumber: true })}
                      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-purple-400 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount_amount" className="flex items-center gap-2 font-medium">
                      <Percent className="h-4 w-4 text-orange-500" />
                      الخصم
                    </Label>
                    <Input
                      id="discount_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register('discount_amount', { valueAsNumber: true })}
                      className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-orange-400 transition-all"
                    />
                  </div>
                </div>

                {/* Financial Summary */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-green-200/50 dark:border-green-800/50"
                >
                  <h4 className="font-semibold text-green-700 dark:text-green-300 mb-3">ملخص مالي:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الإجمالي:</span>
                      <span className="font-bold">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المدفوع:</span>
                      <span className="font-medium text-green-600">{formatCurrency(paidAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الخصم:</span>
                      <span className="font-medium text-orange-600">{formatCurrency(discountAmount)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold">المتبقي:</span>
                      <span className={cn(
                        "font-bold",
                        remainingAmount > 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {formatCurrency(remainingAmount)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notes Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/30 dark:via-yellow-950/30 dark:to-orange-950/30 backdrop-blur-sm h-full">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              <CardHeader className="relative z-10 border-b border-amber-200/50 dark:border-amber-800/50">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 rounded-lg bg-amber-500/10"
                    animate={{ rotate: [0, -360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <FileText className="h-5 w-5 text-amber-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    ملاحظات
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes_ar" className="font-medium">ملاحظات (عربي)</Label>
                  <Textarea
                    id="notes_ar"
                    {...register('notes_ar')}
                    rows={4}
                    className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-amber-400 transition-all resize-none"
                    placeholder="أضف ملاحظات باللغة العربية..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="font-medium">ملاحظات (إنجليزي)</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    rows={4}
                    className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-amber-400 transition-all resize-none"
                    placeholder="Add notes in English..."
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex gap-4 justify-end"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="relative overflow-hidden group border-2 hover:border-red-400 transition-all px-8"
            >
              <X className="ml-2 h-4 w-4" />
              إلغاء
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              type="submit" 
              disabled={updateReservation.isPending}
              className="relative overflow-hidden group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg px-8"
            >
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
              <Save className="ml-2 h-4 w-4 relative z-10" />
              <span className="relative z-10">
                {updateReservation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </span>
            </Button>
          </motion.div>
        </motion.div>
      </form>
    </div>
  )
}
