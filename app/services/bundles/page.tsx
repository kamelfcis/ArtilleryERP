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
import { Plus, Package, Edit, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useServices } from '@/lib/hooks/use-services'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function ServiceBundlesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: bundles, isLoading } = useQuery({
    queryKey: ['service-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_bundles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Package className="h-8 w-8" />
              باقات الخدمات
            </h1>
            <p className="text-muted-foreground">إدارة باقات الخدمات والطعام</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                باقة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>إنشاء باقة جديدة</DialogTitle>
              </DialogHeader>
              <ServiceBundleForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : bundles && bundles.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {bundles.map((bundle) => (
                  <Card key={bundle.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{bundle.name_ar || bundle.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bundle.description_ar && (
                        <p className="text-sm text-muted-foreground mb-4">
                          {bundle.description_ar}
                        </p>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">السعر:</span>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(bundle.price)}
                          </span>
                        </div>
                        {bundle.discount_percentage > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm">الخصم:</span>
                            <span className="text-sm text-green-600">
                              {bundle.discount_percentage}%
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-xs text-muted-foreground">الحالة:</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            bundle.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {bundle.is_active ? 'نشط' : 'غير نشط'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد باقات</p>
                <p className="text-sm mt-2">أنشئ باقات جاهزة لتسريع عملية البيع</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}

function ServiceBundleForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [descriptionAr, setDescriptionAr] = useState('')
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [selectedServices, setSelectedServices] = useState<Array<{ serviceId: string; quantity: number }>>([])
  const { data: services } = useServices()
  const queryClient = useQueryClient()

  const createBundle = useMutation({
    mutationFn: async () => {
      const { data: bundle, error: bundleError } = await supabase
        .from('service_bundles')
        .insert({
          name,
          name_ar: nameAr,
          description_ar: descriptionAr,
          price: parseFloat(price),
          discount_percentage: parseFloat(discount) || 0,
          is_active: isActive,
        })
        .select()
        .single()

      if (bundleError) throw bundleError

      // Add bundle items
      if (selectedServices.length > 0) {
        const bundleItems = selectedServices.map(item => ({
          bundle_id: bundle.id,
          service_id: item.serviceId,
          quantity: item.quantity,
        }))

        const { error: itemsError } = await supabase
          .from('service_bundle_items')
          .insert(bundleItems)

        if (itemsError) throw itemsError
      }

      return bundle
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-bundles'] })
      toast({
        title: 'نجح',
        description: 'تم إنشاء الباقة بنجاح',
      })
      onSuccess?.()
    },
  })

  function handleAddService(serviceId: string, quantity: number) {
    setSelectedServices([...selectedServices, { serviceId, quantity }])
  }

  function handleRemoveService(index: number) {
    setSelectedServices(selectedServices.filter((_, i) => i !== index))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createBundle.mutate()
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bundle-name">الاسم (إنجليزي) *</Label>
          <Input
            id="bundle-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bundle-name-ar">الاسم (عربي) *</Label>
          <Input
            id="bundle-name-ar"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bundle-description">الوصف (عربي)</Label>
        <Input
          id="bundle-description"
          value={descriptionAr}
          onChange={(e) => setDescriptionAr(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bundle-price">السعر (جنيه مصري) *</Label>
          <Input
            id="bundle-price"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bundle-discount">نسبة الخصم (%)</Label>
          <Input
            id="bundle-discount"
            type="number"
            step="0.01"
            max="100"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>نشط</Label>
          <p className="text-sm text-muted-foreground">تفعيل الباقة</p>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      </div>
      <div className="text-sm text-muted-foreground">
        ملاحظة: يمكن إضافة الخدمات للباقة بعد الإنشاء
      </div>
      <Button type="submit" className="w-full" disabled={createBundle.isPending}>
        {createBundle.isPending ? 'جاري الحفظ...' : 'حفظ'}
      </Button>
    </form>
  )
}

