'use client'

import { useParams, useRouter } from 'next/navigation'
import { useReservation } from '@/lib/hooks/use-reservations'
import {
  useServices,
  useReservationServices,
  useAddReservationService,
  useDeleteReservationService,
} from '@/lib/hooks/use-services'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Utensils, Wrench, Receipt, Package } from 'lucide-react'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { useState } from 'react'
import Link from 'next/link'
import { ServiceBundleSelector } from '@/components/reservations/ServiceBundleSelector'

export default function ReservationServicesPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: reservation, isLoading: reservationLoading } = useReservation(id)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [serviceType, setServiceType] = useState<'all' | 'food' | 'service'>('all')

  const { data: services, isLoading: servicesLoading } = useServices({
    isFood: serviceType === 'food' ? true : serviceType === 'service' ? false : undefined,
  })

  const { data: reservationServices, isLoading: servicesListLoading } = useReservationServices(id)
  const addService = useAddReservationService()
  const deleteService = useDeleteReservationService()

  const totalServicesAmount = reservationServices?.reduce((sum, rs) => sum + rs.total_amount, 0) || 0

  async function handleAddService(serviceId: string, quantity: number, notes?: string) {
    await addService.mutateAsync({
      reservationId: id,
      serviceId,
      quantity,
      notes,
    })
    toast({
      title: 'نجح',
      description: 'تم إضافة الخدمة بنجاح',
    })
  }

  async function handleDeleteService(serviceId: string) {
    if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return

    try {
      await deleteService.mutateAsync({
        serviceId,
        reservationId: id,
      })
      toast({
        title: 'نجح',
        description: 'تم حذف الخدمة بنجاح',
      })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف الخدمة',
        variant: 'destructive',
      })
    }
  }

  if (reservationLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-screen w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            رجوع
          </Button>
          <h1 className="text-3xl font-bold mb-2">خدمات وطعام الحجز</h1>
          <p className="text-muted-foreground">
            {reservation?.reservation_number}
          </p>
        </div>
        <ServiceBundleSelector reservationId={id} />
        <Link href={`/reservations/${id}`}>
          <Button variant="outline">
            <Receipt className="mr-2 h-4 w-4" />
            طباعة الفاتورة
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>إضافة خدمة أو طعام</CardTitle>
            <div className="flex gap-2">
              <Select value={serviceType} onValueChange={(value: any) => setServiceType(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="food">طعام</SelectItem>
                  <SelectItem value="service">خدمات</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {servicesLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : services && services.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <Card key={service.id} className="cursor-pointer hover:border-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {service.is_food ? (
                            <Utensils className="h-4 w-4 text-orange-600" />
                          ) : (
                            <Wrench className="h-4 w-4 text-blue-600" />
                          )}
                          <p className="font-semibold">{service.name_ar || service.name}</p>
                        </div>
                        {service.description_ar && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {service.description_ar}
                          </p>
                        )}
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(service.price)} / {service.unit}
                        </p>
                      </div>
                    </div>
                    <AddServiceDialog
                      service={service}
                      reservationId={id}
                      onAdd={handleAddService}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد خدمات متاحة
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الخدمات المضافة</CardTitle>
        </CardHeader>
        <CardContent>
          {servicesListLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : reservationServices && reservationServices.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                {reservationServices.map((rs) => (
                  <div
                    key={rs.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {rs.service?.is_food ? (
                          <Utensils className="h-4 w-4 text-orange-600" />
                        ) : (
                          <Wrench className="h-4 w-4 text-blue-600" />
                        )}
                        <p className="font-semibold">
                          {rs.service?.name_ar || rs.service?.name}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span>الكمية: {rs.quantity} {rs.service?.unit}</span>
                        <span className="mx-2">•</span>
                        <span>السعر: {formatCurrency(rs.unit_price)}</span>
                        <span className="mx-2">•</span>
                        <span>الإجمالي: {formatCurrency(rs.total_amount)}</span>
                      </div>
                      {rs.notes_ar && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {rs.notes_ar}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateShort(rs.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteService(rs.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">إجمالي الخدمات:</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(totalServicesAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">إجمالي الحجز:</span>
                  <span className="text-lg font-semibold">
                    {formatCurrency((reservation?.total_amount || 0))}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد خدمات مضافة
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AddServiceDialog({
  service,
  reservationId,
  onAdd,
}: {
  service: any
  reservationId: string
  onAdd: (serviceId: string, quantity: number, notes?: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال كمية صحيحة',
        variant: 'destructive',
      })
      return
    }
    
    setIsSubmitting(true)
    try {
      await onAdd(service.id, qty, notes || undefined)
      // Close modal after successful addition
      setOpen(false)
      setQuantity('1')
      setNotes('')
    } catch (error) {
      // Error is already handled in onAdd
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          إضافة
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة {service.name_ar || service.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">الكمية *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              الوحدة: {service.unit}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية..."
            />
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="flex justify-between text-sm mb-1">
              <span>السعر:</span>
              <span>{formatCurrency(service.price)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>الكمية:</span>
              <span>{quantity}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>الإجمالي:</span>
              <span className="text-primary">
                {formatCurrency(service.price * (parseFloat(quantity) || 0))}
              </span>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

