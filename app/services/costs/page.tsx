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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, DollarSign, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { useServices } from '@/lib/hooks/use-services'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function ServiceCostsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: services } = useServices()
  const { data: costs, isLoading } = useQuery({
    queryKey: ['service-costs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_costs')
        .select(`
          *,
          service:services (*)
        `)
        .order('effective_from', { ascending: false })

      if (error) throw error
      return data
    },
  })

  // Calculate profit margins
  const costsWithProfit = costs?.map((cost: any) => {
    const servicePrice = cost.service?.price || 0
    const profit = servicePrice - cost.cost_per_unit
    const profitMargin = servicePrice > 0 ? (profit / servicePrice) * 100 : 0
    return {
      ...cost,
      profit,
      profitMargin,
    }
  }) || []

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <DollarSign className="h-8 w-8" />
              تكاليف الخدمات
            </h1>
            <p className="text-muted-foreground">تتبع تكاليف الخدمات وحساب الأرباح</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                إضافة تكلفة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة تكلفة خدمة</DialogTitle>
              </DialogHeader>
              <ServiceCostForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : costsWithProfit.length > 0 ? (
              <div className="space-y-2">
                {costsWithProfit.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-semibold">
                        {item.service?.name_ar || item.service?.name || 'غير معروف'}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span>سعر البيع: {formatCurrency(item.service?.price || 0)}</span>
                        <span>التكلفة: {formatCurrency(item.cost_per_unit)}</span>
                        <span>الربح: {formatCurrency(item.profit)}</span>
                        <span className={`font-semibold ${
                          item.profitMargin >= 50 ? 'text-green-600' :
                          item.profitMargin >= 30 ? 'text-blue-600' :
                          item.profitMargin >= 10 ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          هامش الربح: {item.profitMargin.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        فعال من: {formatDateShort(item.effective_from)}
                        {item.effective_to && ` إلى: ${formatDateShort(item.effective_to)}`}
                      </p>
                    </div>
                    <TrendingUp className={`h-5 w-5 ${
                      item.profitMargin >= 30 ? 'text-green-600' : 'text-orange-600'
                    }`} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد تكاليف مسجلة</p>
                <p className="text-sm mt-2">أضف تكاليف الخدمات لتتبع الأرباح</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}

function ServiceCostForm({ onSuccess }: { onSuccess?: () => void }) {
  const [serviceId, setServiceId] = useState('')
  const [cost, setCost] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0])
  const [effectiveTo, setEffectiveTo] = useState('')
  const [notes, setNotes] = useState('')
  const { data: services } = useServices()
  const queryClient = useQueryClient()

  const createCost = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('service_costs')
        .insert({
          service_id: serviceId,
          cost_per_unit: parseFloat(cost),
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null,
          notes_ar: notes || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-costs'] })
      toast({
        title: 'نجح',
        description: 'تم إضافة التكلفة بنجاح',
      })
      onSuccess?.()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createCost.mutate()
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="service">الخدمة *</Label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger>
            <SelectValue placeholder="اختر الخدمة" />
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
        <Label htmlFor="cost">التكلفة لكل وحدة (جنيه مصري) *</Label>
        <Input
          id="cost"
          type="number"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="effective-from">فعال من *</Label>
          <Input
            id="effective-from"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="effective-to">فعال حتى</Label>
          <Input
            id="effective-to"
            type="date"
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
            min={effectiveFrom}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">ملاحظات</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={createCost.isPending}>
        {createCost.isPending ? 'جاري الحفظ...' : 'حفظ'}
      </Button>
    </form>
  )
}

