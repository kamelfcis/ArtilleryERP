'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { DollarSign, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function FinancialReconciliationPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: reconciliation, isLoading } = useQuery({
    queryKey: ['financial-reconciliation', dateFrom, dateTo],
    queryFn: async () => {
      if (!dateFrom || !dateTo) return null

      let query = supabase
        .from('reservations')
        .select('*')
        .gte('check_in_date', dateFrom)
        .lte('check_out_date', dateTo)
        .neq('status', 'cancelled')

      const { data: reservations, error } = await query
      if (error) throw error

      const totalRevenue = reservations?.reduce((sum, r) => sum + r.total_amount, 0) || 0
      const totalPaid = reservations?.reduce((sum, r) => sum + r.paid_amount, 0) || 0
      const totalDiscounts = reservations?.reduce((sum, r) => sum + r.discount_amount, 0) || 0
      const totalOutstanding = totalRevenue - totalPaid - totalDiscounts

      // Group by status
      const byStatus = reservations?.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + r.total_amount
        return acc
      }, {} as Record<string, number>) || {}

      // Group by payment status
      const fullyPaid = reservations?.filter(r => 
        r.total_amount <= r.paid_amount + r.discount_amount
      ).length || 0
      const partiallyPaid = reservations?.filter(r => 
        r.paid_amount > 0 && r.total_amount > r.paid_amount + r.discount_amount
      ).length || 0
      const unpaid = reservations?.filter(r => r.paid_amount === 0).length || 0

      return {
        reservations: reservations || [],
        summary: {
          totalRevenue,
          totalPaid,
          totalDiscounts,
          totalOutstanding,
          fullyPaid,
          partiallyPaid,
          unpaid,
        },
        byStatus,
      }
    },
    enabled: !!dateFrom && !!dateTo,
  })

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">المصالحة المالية</h1>
          <p className="text-muted-foreground">مطابقة الإيرادات والمدفوعات</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>الفترة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-from">من تاريخ</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">إلى تاريخ</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : reconciliation ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(reconciliation.summary.totalRevenue)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">المبلغ المدفوع</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(reconciliation.summary.totalPaid)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">المتبقي</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(reconciliation.summary.totalOutstanding)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الخصومات</CardTitle>
                  <DollarSign className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(reconciliation.summary.totalDiscounts)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>حالة الدفع</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مدفوع بالكامل:</span>
                    <span className="font-semibold text-green-600">{reconciliation.summary.fullyPaid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مدفوع جزئياً:</span>
                    <span className="font-semibold text-yellow-600">{reconciliation.summary.partiallyPaid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">غير مدفوع:</span>
                    <span className="font-semibold text-red-600">{reconciliation.summary.unpaid}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>توزيع حسب الحالة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(reconciliation.byStatus).map(([status, amount]) => (
                      <div key={status} className="flex justify-between">
                        <span className="text-sm">{status}</span>
                        <span className="font-semibold">{formatCurrency(amount as number)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              اختر فترة لعرض المصالحة المالية
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  )
}

