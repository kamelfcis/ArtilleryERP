'use client'

import { useState } from 'react'
import { useDiscountCodes, useCreateDiscountCode } from '@/lib/hooks/use-discounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Plus, Edit, Trash2, Tag, CheckCircle, XCircle } from 'lucide-react'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export default function DiscountsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: discounts, isLoading } = useDiscountCodes()
  
  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('discount_codes')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] })
      toast({
        title: 'نجح',
        description: 'تم حذف كود الخصم',
      })
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Tag className="h-8 w-8" />
            أكواد الخصم
          </h1>
          <p className="text-muted-foreground">إدارة أكواد الخصم والقسائم</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingDiscount(null)
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingDiscount(null)}>
              <Plus className="mr-2 h-4 w-4" />
              كود خصم جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDiscount ? 'تعديل كود الخصم' : 'كود خصم جديد'}
              </DialogTitle>
            </DialogHeader>
            <DiscountForm
              discountId={editingDiscount || undefined}
              onSuccess={() => {
                setDialogOpen(false)
                setEditingDiscount(null)
              }}
            />
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
          ) : discounts && discounts.length > 0 ? (
            <div className="space-y-2">
              {discounts.map((discount) => (
                <div
                  key={discount.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-lg">{discount.code}</span>
                      {discount.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-sm font-medium">{discount.name_ar}</p>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>
                        {discount.discount_type === 'percentage'
                          ? `${discount.discount_value}%`
                          : `${formatCurrency(discount.discount_value)}`}
                      </span>
                      {discount.valid_from && discount.valid_to && (
                        <span>
                          {formatDateShort(discount.valid_from)} - {formatDateShort(discount.valid_to)}
                        </span>
                      )}
                      {discount.max_uses && (
                        <span>
                          مستخدم {discount.used_count} / {discount.max_uses}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingDiscount(discount.id)
                        setDialogOpen(true)
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      تعديل
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('هل أنت متأكد من حذف كود الخصم؟')) {
                          deleteDiscount.mutate(discount.id)
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد أكواد خصم</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DiscountForm({
  discountId,
  onSuccess,
}: {
  discountId?: string
  onSuccess?: () => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage')
  const [value, setValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [isActive, setIsActive] = useState(true)
  const createDiscount = useCreateDiscountCode()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      await createDiscount.mutateAsync({
        code,
        name,
        name_ar: nameAr,
        discount_type: type,
        discount_value: parseFloat(value),
        max_uses: maxUses ? parseInt(maxUses) : undefined,
        min_amount: minAmount ? parseFloat(minAmount) : undefined,
        valid_from: validFrom || undefined,
        valid_to: validTo || undefined,
        is_active: isActive,
      })

      toast({
        title: 'نجح',
        description: 'تم إنشاء كود الخصم بنجاح',
      })
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء كود الخصم',
        variant: 'destructive',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <Label htmlFor="name_ar">الاسم (عربي) *</Label>
          <Input
            id="name_ar"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="code">كود الخصم *</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="مثال: SUMMER2024"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">نوع الخصم</Label>
          <Select value={type} onValueChange={(value: any) => setType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">نسبة مئوية</SelectItem>
              <SelectItem value="fixed">مبلغ ثابت</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="value">قيمة الخصم *</Label>
          <Input
            id="value"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'percentage' ? '10%' : '100 جنيه مصري'}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valid-from">صالح من</Label>
          <Input
            id="valid-from"
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valid-to">صالح حتى</Label>
          <Input
            id="valid-to"
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            min={validFrom}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="max-uses">الحد الأقصى للاستخدام</Label>
          <Input
            id="max-uses"
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="اتركه فارغاً للاستخدام غير المحدود"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="min-amount">الحد الأدنى للمبلغ (جنيه مصري)</Label>
          <Input
            id="min-amount"
            type="number"
            step="0.01"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="الحد الأدنى للطلب"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>نشط</Label>
          <p className="text-sm text-muted-foreground">تفعيل كود الخصم</p>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      </div>
      <Button type="submit" className="w-full" disabled={createDiscount.isPending}>
        {createDiscount.isPending ? 'جاري الحفظ...' : 'حفظ'}
      </Button>
    </form>
  )
}

