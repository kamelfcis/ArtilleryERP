'use client'

import { useState } from 'react'
import { useServices, useAddReservationService } from '@/lib/hooks/use-services'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { Utensils, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ServiceQuickAddProps {
  reservationId: string
}

export function ServiceQuickAdd({ reservationId }: ServiceQuickAddProps) {
  const [open, setOpen] = useState(false)
  const [selectedService, setSelectedService] = useState('')
  const [quantity, setQuantity] = useState('1')
  const { data: services } = useServices()
  const addService = useAddReservationService()

  const popularServices = services?.slice(0, 5) || []

  async function handleQuickAdd(serviceId: string) {
    try {
      await addService.mutateAsync({
        reservationId,
        serviceId,
        quantity: 1,
      })
      toast({
        title: 'نجح',
        description: 'تم إضافة الخدمة بنجاح',
      })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إضافة الخدمة',
        variant: 'destructive',
      })
    }
  }

  async function handleAdd() {
    if (!selectedService) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار خدمة',
        variant: 'destructive',
      })
      return
    }

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال كمية صحيحة',
        variant: 'destructive',
      })
      return
    }

    try {
      await addService.mutateAsync({
        reservationId,
        serviceId: selectedService,
        quantity: qty,
      })
      toast({
        title: 'نجح',
        description: 'تم إضافة الخدمة بنجاح',
      })
      setOpen(false)
      setSelectedService('')
      setQuantity('1')
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إضافة الخدمة',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Utensils className="mr-2 h-4 w-4" />
          إضافة خدمة سريعة
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة خدمة سريعة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {popularServices.length > 0 && (
            <div>
              <Label className="mb-2 block">الخدمات الشائعة</Label>
              <div className="grid grid-cols-2 gap-2">
                {popularServices.map((service) => (
                  <Button
                    key={service.id}
                    variant="outline"
                    className="justify-start"
                    onClick={() => handleQuickAdd(service.id)}
                    disabled={addService.isPending}
                  >
                    <Utensils className="mr-2 h-4 w-4" />
                    <div className="text-right">
                      <p className="text-sm font-medium">{service.name_ar || service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(service.price)}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service-select">اختر خدمة</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر خدمة" />
                  </SelectTrigger>
                  <SelectContent>
                    {services?.map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name_ar || service.name} - {formatCurrency(service.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">الكمية</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAdd}
                className="w-full"
                disabled={!selectedService || addService.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                إضافة
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

