'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Clock, Calendar } from 'lucide-react'
import { useServices } from '@/lib/hooks/use-services'
import { RoleGuard } from '@/components/auth/RoleGuard'

const daysOfWeek = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
]

export default function ServiceAvailabilityPage() {
  const [selectedService, setSelectedService] = useState<string>('')
  const { data: services } = useServices()

  const { data: availability, isLoading } = useQuery({
    queryKey: ['service-availability', selectedService],
    queryFn: async () => {
      if (!selectedService) return []

      const { data, error } = await supabase
        .from('service_availability')
        .select('*')
        .eq('service_id', selectedService)
        .order('day_of_week', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!selectedService,
  })

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            جدولة توفر الخدمات
          </h1>
          <p className="text-muted-foreground">إدارة أوقات توفر الخدمات</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>اختر الخدمة</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="اختر خدمة" />
              </SelectTrigger>
              <SelectContent>
                {services?.map(service => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name_ar || service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedService && (
          <Card>
            <CardHeader>
              <CardTitle>جدول التوفر</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="space-y-4">
                  {daysOfWeek.map((day) => {
                    const dayAvailability = availability?.find((a: any) => a.day_of_week === day.value)
                    return (
                      <DayAvailabilityRow
                        key={day.value}
                        day={day}
                        serviceId={selectedService}
                        availability={dayAvailability}
                      />
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  )
}

function DayAvailabilityRow({
  day,
  serviceId,
  availability,
}: {
  day: { value: number; label: string }
  serviceId: string
  availability?: any
}) {
  const [isAvailable, setIsAvailable] = useState(availability?.is_available ?? true)
  const [startTime, setStartTime] = useState(availability?.start_time || '09:00')
  const [endTime, setEndTime] = useState(availability?.end_time || '18:00')
  const [maxQuantity, setMaxQuantity] = useState(availability?.max_quantity_per_day?.toString() || '')
  const queryClient = useQueryClient()

  const updateAvailability = useMutation({
    mutationFn: async () => {
      if (availability) {
        const { error } = await supabase
          .from('service_availability')
          .update({
            is_available: isAvailable,
            start_time: isAvailable ? startTime : null,
            end_time: isAvailable ? endTime : null,
            max_quantity_per_day: maxQuantity ? parseInt(maxQuantity) : null,
          })
          .eq('id', availability.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('service_availability')
          .insert({
            service_id: serviceId,
            day_of_week: day.value,
            is_available: isAvailable,
            start_time: isAvailable ? startTime : null,
            end_time: isAvailable ? endTime : null,
            max_quantity_per_day: maxQuantity ? parseInt(maxQuantity) : null,
          })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-availability', serviceId] })
      toast({
        title: 'نجح',
        description: 'تم تحديث الجدول بنجاح',
      })
    },
  })

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className="w-24 font-medium">{day.label}</div>
      <div className="flex items-center gap-2">
        <Switch
          checked={isAvailable}
          onCheckedChange={setIsAvailable}
        />
        <span className="text-sm text-muted-foreground">متاح</span>
      </div>
      {isAvailable && (
        <>
          <div className="flex items-center gap-2">
            <Label htmlFor={`start-${day.value}`} className="text-sm">من:</Label>
            <Input
              id={`start-${day.value}`}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`end-${day.value}`} className="text-sm">إلى:</Label>
            <Input
              id={`end-${day.value}`}
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`max-${day.value}`} className="text-sm">الحد الأقصى:</Label>
            <Input
              id={`max-${day.value}`}
              type="number"
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(e.target.value)}
              className="w-24"
              placeholder="غير محدود"
            />
          </div>
        </>
      )}
      <Button
        size="sm"
        onClick={() => updateAvailability.mutate()}
        disabled={updateAvailability.isPending}
      >
        حفظ
      </Button>
    </div>
  )
}

