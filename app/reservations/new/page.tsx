'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reservationSchema, type ReservationFormData } from '@/lib/validations/reservation'
import { useCreateReservation } from '@/lib/hooks/use-reservations'
import { useUnits } from '@/lib/hooks/use-units'
import { useGuests } from '@/lib/hooks/use-guests'
import { useLocations } from '@/lib/hooks/use-locations'
import { usePricing } from '@/lib/hooks/use-pricing'
import { calculateReservationPrice } from '@/lib/utils/pricing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { GuestForm } from '@/components/forms/GuestForm'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useCreateBookingNotification } from '@/lib/hooks/use-booking-notifications'

export default function NewReservationPage() {
  const router = useRouter()
  const { user, hasRole } = useAuth()
  const isBranchManager = hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any)
  const createReservation = useCreateReservation()
  const createNotification = useCreateBookingNotification()
  const { data: locations } = useLocations()
  const { data: units } = useUnits()
  const { data: guests } = useGuests()
  const { data: pricingData } = usePricing({ isActive: true })
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      status: 'pending',
      source: 'phone',
      adults: 1,
      children: 0,
      total_amount: 0,
      paid_amount: 0,
      discount_amount: 0,
    },
  })

  const filteredUnits = units?.filter(u => 
    !selectedLocation || u.location_id === selectedLocation
  )

  // Watch fields for auto-calculation
  const watchedUnitId = watch('unit_id')
  const watchedGuestId = watch('guest_id')
  const watchedCheckIn = watch('check_in_date')
  const watchedCheckOut = watch('check_out_date')

  async function onSubmit(data: ReservationFormData) {
    try {
      const result = await createReservation.mutateAsync({ ...data, created_by: user?.id })
      if (isBranchManager && user?.id && result?.id) {
        const guest = guests?.find(g => g.id === data.guest_id)
        const unit = units?.find(u => u.id === data.unit_id)
        const loc = locations?.find(l => l.id === unit?.location_id)
        const gName = guest ? `${guest.first_name_ar || guest.first_name} ${guest.last_name_ar || guest.last_name}` : ''
        const uName = unit ? unit.unit_number : ''
        const lName = loc ? (loc.name_ar || loc.name) : ''
        const nights = Math.ceil((new Date(data.check_out_date).getTime() - new Date(data.check_in_date).getTime()) / 86400000)
        createNotification.mutate({
          reservation_id: result.id,
          created_by: user.id,
          message: `📋 حجز جديد من ${user.email || 'مدير فرع'} | الضيف: ${gName} | الوحدة: ${uName} — ${lName} | ${data.check_in_date} إلى ${data.check_out_date} (${nights} ليلة) | المبلغ: ${data.total_amount} ج.م`,
        })
      }
      toast({
        title: 'نجح',
        description: 'تم إنشاء الحجز بنجاح',
      })
      router.push('/reservations')
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء الحجز',
        variant: 'destructive',
      })
    }
  }

  const calculateTotal = useCallback(async () => {
    const checkIn = watchedCheckIn
    const checkOut = watchedCheckOut
    const unitId = watchedUnitId
    const guestId = watchedGuestId
    
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

    setCalculatedPrice(total)
    return total
  }, [watchedCheckIn, watchedCheckOut, watchedUnitId, watchedGuestId, units, guests, pricingData])

  // Auto-calculate when relevant fields change
  useEffect(() => {
    if (watchedUnitId && watchedCheckIn && watchedCheckOut) {
      calculateTotal().then(total => {
        if (total > 0) {
          setValue('total_amount', total)
        }
      })
    }
  }, [watchedUnitId, watchedGuestId, watchedCheckIn, watchedCheckOut, calculateTotal, setValue])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">حجز جديد</h1>
        <p className="text-muted-foreground">إنشاء حجز جديد</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>معلومات الحجز</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">الموقع</Label>
                <Select
                  value={selectedLocation}
                  onValueChange={setSelectedLocation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموقع" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_id">الوحدة *</Label>
                <Select
                  onValueChange={(value) => setValue('unit_id', value)}
                >
                  <SelectTrigger>
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
                <Label htmlFor="check_in_date">تاريخ الدخول *</Label>
                <Input
                  id="check_in_date"
                  type="date"
                  {...register('check_in_date')}
                />
                {errors.check_in_date && (
                  <p className="text-sm text-destructive">{errors.check_in_date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="check_out_date">تاريخ الخروج *</Label>
                <Input
                  id="check_out_date"
                  type="date"
                  {...register('check_out_date')}
                />
                {errors.check_out_date && (
                  <p className="text-sm text-destructive">{errors.check_out_date.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guest_id">الضيف *</Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => setValue('guest_id', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="اختر الضيف" />
                    </SelectTrigger>
                    <SelectContent>
                      {guests?.map(guest => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {guest.first_name_ar || guest.first_name} {guest.last_name_ar || guest.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>إضافة ضيف جديد</DialogTitle>
                      </DialogHeader>
                      <GuestForm
                        onSuccess={() => {
                          setGuestDialogOpen(false)
                          // Refresh guests list
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
                {errors.guest_id && (
                  <p className="text-sm text-destructive">{errors.guest_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">الحالة</Label>
                <Select
                  defaultValue="pending"
                  onValueChange={(value) => setValue('status', value as any)}
                  disabled={isBranchManager}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    {!isBranchManager && (
                      <>
                        <SelectItem value="confirmed">مؤكد</SelectItem>
                        <SelectItem value="checked_in">تم تسجيل الدخول</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adults">عدد البالغين *</Label>
                <Input
                  id="adults"
                  type="number"
                  min="1"
                  {...register('adults', { valueAsNumber: true })}
                />
                {errors.adults && (
                  <p className="text-sm text-destructive">{errors.adults.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="children">عدد الأطفال</Label>
                <Input
                  id="children"
                  type="number"
                  min="0"
                  {...register('children', { valueAsNumber: true })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>المعلومات المالية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_amount">المبلغ الإجمالي *</Label>
                <Input
                  id="total_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('total_amount', { valueAsNumber: true })}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    setValue('total_amount', value)
                  }}
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
                >
                  حساب تلقائي
                </Button>
                {calculatedPrice !== null && calculatedPrice > 0 && (
                  <p className="text-xs text-muted-foreground">
                    السعر المحسوب: {formatCurrency(calculatedPrice)}
                  </p>
                )}
                {errors.total_amount && (
                  <p className="text-sm text-destructive">{errors.total_amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paid_amount">المبلغ المدفوع</Label>
                <Input
                  id="paid_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('paid_amount', { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount_amount">الخصم</Label>
                <Input
                  id="discount_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('discount_amount', { valueAsNumber: true })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ملاحظات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات (إنجليزي)</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes_ar">ملاحظات (عربي)</Label>
              <Textarea
                id="notes_ar"
                {...register('notes_ar')}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            إلغاء
          </Button>
          <Button type="submit" disabled={createReservation.isPending}>
            {createReservation.isPending ? 'جاري الحفظ...' : 'حفظ الحجز'}
          </Button>
        </div>
      </form>
    </div>
  )
}

