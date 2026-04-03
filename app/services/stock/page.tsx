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
import { Badge } from '@/components/ui/badge'
import { Plus, Package, AlertTriangle } from 'lucide-react'
import { useServices } from '@/lib/hooks/use-services'
import { useLocations } from '@/lib/hooks/use-locations'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function ServiceStockPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const queryClient = useQueryClient()
  const { data: locations } = useLocations()

  const { data: stock, isLoading } = useQuery({
    queryKey: ['service-stock', locationFilter],
    queryFn: async () => {
      let query = supabase
        .from('service_stock')
        .select(`
          *,
          service:services (*),
          location:locations (*)
        `)
        .order('last_updated', { ascending: false })

      if (locationFilter !== 'all') {
        query = query.eq('location_id', locationFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const lowStockItems = stock?.filter((item: any) => 
    item.current_stock <= item.min_stock
  ) || []

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Package className="h-8 w-8" />
              مخزون الخدمات
            </h1>
            <p className="text-muted-foreground">إدارة مخزون الخدمات والمواد</p>
          </div>
          <div className="flex gap-2">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="جميع المواقع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المواقع</SelectItem>
                {locations?.map(location => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  إضافة مخزون
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة مخزون خدمة</DialogTitle>
                </DialogHeader>
                <ServiceStockForm onSuccess={() => setDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="h-5 w-5" />
                تنبيه: مخزون منخفض ({lowStockItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded">
                    <span className="text-sm">{item.service?.name_ar || item.service?.name}</span>
                    <Badge variant="destructive">
                      {item.current_stock} / {item.min_stock} {item.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : stock && stock.length > 0 ? (
              <div className="space-y-2">
                {stock.map((item: any) => {
                  const stockPercentage = item.max_stock 
                    ? (item.current_stock / item.max_stock) * 100 
                    : 0
                  const isLowStock = item.current_stock <= item.min_stock

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{item.service?.name_ar || item.service?.name}</p>
                          {isLowStock && (
                            <Badge variant="destructive" className="text-xs">
                              مخزون منخفض
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.location?.name_ar || item.location?.name}
                        </p>
                        <div className="mt-2 w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isLowStock ? 'bg-red-600' : 
                              stockPercentage < 30 ? 'bg-orange-600' : 
                              'bg-green-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, stockPercentage))}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.current_stock} {item.unit} متاح
                          {item.min_stock > 0 && ` (الحد الأدنى: ${item.min_stock})`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                لا يوجد مخزون مسجل
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}

function ServiceStockForm({ onSuccess }: { onSuccess?: () => void }) {
  const [serviceId, setServiceId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [currentStock, setCurrentStock] = useState('0')
  const [minStock, setMinStock] = useState('0')
  const [maxStock, setMaxStock] = useState('')
  const [unit, setUnit] = useState('piece')
  const { data: services } = useServices()
  const { data: locations } = useLocations()
  const queryClient = useQueryClient()

  const createStock = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('service_stock')
        .insert({
          service_id: serviceId,
          location_id: locationId || null,
          current_stock: parseFloat(currentStock) || 0,
          min_stock: parseFloat(minStock) || 0,
          max_stock: maxStock ? parseFloat(maxStock) : null,
          unit,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-stock'] })
      toast({
        title: 'نجح',
        description: 'تم إضافة المخزون بنجاح',
      })
      onSuccess?.()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createStock.mutate()
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="stock-service">الخدمة *</Label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger>
            <SelectValue placeholder="اختر الخدمة" />
          </SelectTrigger>
          <SelectContent>
            {services?.map(service => (
              <SelectItem key={service.id} value={service.id}>
                {service.name_ar || service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="stock-location">الموقع</Label>
        <Select value={locationId || 'all'} onValueChange={(value) => setLocationId(value === 'all' ? '' : value)}>
          <SelectTrigger>
            <SelectValue placeholder="اختر الموقع (اختياري)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المواقع</SelectItem>
            {locations?.map(location => (
              <SelectItem key={location.id} value={location.id}>
                {location.name_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="current-stock">المخزون الحالي *</Label>
          <Input
            id="current-stock"
            type="number"
            step="0.01"
            value={currentStock}
            onChange={(e) => setCurrentStock(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="min-stock">الحد الأدنى *</Label>
          <Input
            id="min-stock"
            type="number"
            step="0.01"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-stock">الحد الأقصى</Label>
          <Input
            id="max-stock"
            type="number"
            step="0.01"
            value={maxStock}
            onChange={(e) => setMaxStock(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="stock-unit">الوحدة *</Label>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="piece">قطعة</SelectItem>
            <SelectItem value="box">صندوق</SelectItem>
            <SelectItem value="kg">كيلوغرام</SelectItem>
            <SelectItem value="liter">لتر</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={createStock.isPending}>
        {createStock.isPending ? 'جاري الحفظ...' : 'حفظ'}
      </Button>
    </form>
  )
}

