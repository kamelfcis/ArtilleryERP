'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useCreateFacility, useUpdateFacility, useFacilities } from '@/lib/hooks/use-facilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { DialogFooter } from '@/components/ui/dialog'
import { Facility } from '@/lib/types/database'

interface FacilityFormProps {
  facilityId?: string
  onSuccess?: () => void
}

export function FacilityForm({ facilityId, onSuccess }: FacilityFormProps) {
  const { data: facilities } = useFacilities()
  const createFacility = useCreateFacility()
  const updateFacility = useUpdateFacility()

  const facility = facilities?.find(f => f.id === facilityId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Partial<Facility>>({
    defaultValues: facility || {
      name: '',
      name_ar: '',
      description: '',
      description_ar: '',
    },
  })

  useEffect(() => {
    if (facility) {
      reset(facility)
    }
  }, [facility, reset])

  async function onSubmit(data: Partial<Facility>) {
    try {
      if (facilityId) {
        await updateFacility.mutateAsync({ id: facilityId, ...data })
        toast({
          title: 'نجح',
          description: 'تم تحديث المرفق بنجاح',
        })
      } else {
        await createFacility.mutateAsync(data)
        toast({
          title: 'نجح',
          description: 'تم إضافة المرفق بنجاح',
        })
      }
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ المرفق',
        variant: 'destructive',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">الاسم (إنجليزي) *</Label>
          <Input
            id="name"
            {...register('name', { required: 'يجب إدخال الاسم' })}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name_ar">الاسم (عربي) *</Label>
          <Input
            id="name_ar"
            {...register('name_ar', { required: 'يجب إدخال الاسم' })}
          />
          {errors.name_ar && (
            <p className="text-sm text-destructive">{errors.name_ar.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="icon">الأيقونة</Label>
        <Input
          id="icon"
          placeholder="اسم الأيقونة (lucide-react)"
          {...register('icon')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="description">الوصف (إنجليزي)</Label>
          <Textarea
            id="description"
            {...register('description')}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description_ar">الوصف (عربي)</Label>
          <Textarea
            id="description_ar"
            {...register('description_ar')}
            rows={3}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="submit"
          disabled={createFacility.isPending || updateFacility.isPending}
        >
          {createFacility.isPending || updateFacility.isPending
            ? 'جاري الحفظ...'
            : 'حفظ'}
        </Button>
      </DialogFooter>
    </form>
  )
}

