'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateLocation, useUpdateLocation, useLocation } from '@/lib/hooks/use-locations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { DialogFooter } from '@/components/ui/dialog'
import { Location } from '@/lib/types/database'

interface LocationFormProps {
  locationId?: string
  onSuccess?: () => void
}

export function LocationForm({ locationId, onSuccess }: LocationFormProps) {
  const { data: location } = useLocation(locationId || '', { enabled: !!locationId })
  const createLocation = useCreateLocation()
  const updateLocation = useUpdateLocation()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Partial<Location>>({
    defaultValues: {
      name: '',
      name_ar: '',
      address: '',
      address_ar: '',
      phone: '',
      email: '',
    },
  })

  useEffect(() => {
    if (location) {
      reset(location)
    } else if (!locationId) {
      // Reset form when creating new location
      reset({
        name: '',
        name_ar: '',
        address: '',
        address_ar: '',
        phone: '',
        email: '',
      })
    }
  }, [location, locationId, reset])

  async function onSubmit(data: Partial<Location>) {
    try {
      if (locationId) {
        await updateLocation.mutateAsync({ id: locationId, ...data })
        toast({
          title: 'نجح',
          description: 'تم تحديث الموقع بنجاح',
        })
      } else {
        await createLocation.mutateAsync(data)
        toast({
          title: 'نجح',
          description: 'تم إضافة الموقع بنجاح',
        })
      }
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ الموقع',
        variant: 'destructive',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name_ar">الاسم (عربي) *</Label>
          <Input
            id="name_ar"
            {...register('name_ar', { required: 'يجب إدخال الاسم بالعربي' })}
          />
          {errors.name_ar && (
            <p className="text-sm text-destructive">{errors.name_ar.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">الاسم (إنجليزي) *</Label>
          <Input
            id="name"
            {...register('name', { required: 'يجب إدخال الاسم بالإنجليزي' })}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="address_ar">العنوان (عربي)</Label>
          <Textarea
            id="address_ar"
            {...register('address_ar')}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">العنوان (إنجليزي)</Label>
          <Textarea
            id="address"
            {...register('address')}
            rows={3}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">الهاتف</Label>
          <Input
            id="phone"
            type="tel"
            {...register('phone')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={createLocation.isPending || updateLocation.isPending}>
          {locationId ? 'تحديث' : 'إضافة'}
        </Button>
      </DialogFooter>
    </form>
  )
}

