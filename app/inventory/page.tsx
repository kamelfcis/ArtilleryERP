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
import { Plus, Package, AlertTriangle, TrendingDown } from 'lucide-react'
import { useLocations } from '@/lib/hooks/use-locations'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function InventoryPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const queryClient = useQueryClient()
  const { data: locations } = useLocations()

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory-items', locationFilter],
    queryFn: async () => {
      let query = supabase
        .from('inventory_items')
        .select(`
          *,
          category:inventory_categories (*),
          location:locations (*)
        `)
        .order('name_ar', { ascending: true })

      if (locationFilter !== 'all') {
        query = query.eq('location_id', locationFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const lowStockItems = items?.filter(item => 
    item.current_stock <= item.min_stock
  ) || []

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Package className="h-8 w-8" />
              إدارة المخزون
            </h1>
            <p className="text-muted-foreground">إدارة المخزون والمواد</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                إضافة مادة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة مادة جديدة</DialogTitle>
              </DialogHeader>
              <InventoryItemForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
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
                {lowStockItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded">
                    <span className="text-sm">{item.name_ar || item.name}</span>
                    <Badge variant="destructive">
                      {item.current_stock} / {item.min_stock}
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
            ) : items && items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item) => {
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
                          <p className="font-semibold">{item.name_ar || item.name}</p>
                          {isLowStock && (
                            <Badge variant="destructive" className="text-xs">
                              مخزون منخفض
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.category?.name_ar || item.category?.name} • {item.location?.name_ar || item.location?.name}
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
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد مواد في المخزون
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}

function InventoryItemForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [unit, setUnit] = useState('piece')
  const [currentStock, setCurrentStock] = useState('0')
  const [minStock, setMinStock] = useState('0')
  const [maxStock, setMaxStock] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const { data: locations } = useLocations()
  const queryClient = useQueryClient()

  const { data: categories } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .order('name_ar')

      if (error) throw error
      return data
    },
  })

  const createItem = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({
          name,
          name_ar: nameAr,
          sku: sku || null,
          category_id: categoryId || null,
          location_id: locationId || null,
          unit,
          current_stock: parseFloat(currentStock) || 0,
          min_stock: parseFloat(minStock) || 0,
          max_stock: maxStock ? parseFloat(maxStock) : null,
          unit_price: unitPrice ? parseFloat(unitPrice) : null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      toast({
        title: 'نجح',
        description: 'تم إضافة المادة بنجاح',
      })
      onSuccess?.()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        createItem.mutate()
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">الاسم (إنجليزي) *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name-ar">الاسم (عربي) *</Label>
          <Input
            id="name-ar"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku">رمز SKU</Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">الوحدة *</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="piece">قطعة</SelectItem>
              <SelectItem value="box">صندوق</SelectItem>
              <SelectItem value="kg">كيلوغرام</SelectItem>
              <SelectItem value="liter">لتر</SelectItem>
              <SelectItem value="meter">متر</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">الفئة</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الفئة" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">الموقع</Label>
          <Select value={locationId} onValueChange={setLocationId}>
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
        <Label htmlFor="unit-price">سعر الوحدة (جنيه مصري)</Label>
        <Input
          id="unit-price"
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={createItem.isPending}>
        {createItem.isPending ? 'جاري الحفظ...' : 'حفظ'}
      </Button>
    </form>
  )
}

