'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateShort } from '@/lib/utils'
import { History, Edit, Trash2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function ServiceHistoryPage() {
  const [actionFilter, setActionFilter] = useState<string>('all')

  const { data: history, isLoading } = useQuery({
    queryKey: ['service-history', actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('service_history')
        .select(`
          *,
          reservation_service:reservation_services (
            *,
            service:services (*),
            reservation:reservations (
              reservation_number
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })

  const actionLabels: Record<string, { label: string; icon: any; color: string }> = {
    added: { label: 'إضافة', icon: Edit, color: 'text-green-600' },
    modified: { label: 'تعديل', icon: Edit, color: 'text-blue-600' },
    cancelled: { label: 'إلغاء', icon: Trash2, color: 'text-red-600' },
    refunded: { label: 'استرداد', icon: RotateCcw, color: 'text-orange-600' },
  }

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <History className="h-8 w-8" />
              سجل الخدمات
            </h1>
            <p className="text-muted-foreground">تتبع جميع التغييرات على الخدمات</p>
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="جميع الإجراءات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الإجراءات</SelectItem>
              <SelectItem value="added">إضافة</SelectItem>
              <SelectItem value="modified">تعديل</SelectItem>
              <SelectItem value="cancelled">إلغاء</SelectItem>
              <SelectItem value="refunded">استرداد</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((item: any) => {
                  const actionInfo = actionLabels[item.action] || { label: item.action, icon: Edit, color: 'text-gray-600' }
                  const Icon = actionInfo.icon

                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className={`p-2 rounded-full bg-muted ${actionInfo.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{actionInfo.label}</span>
                          <span className="text-sm text-muted-foreground">
                            {item.reservation_service?.service?.name_ar || item.reservation_service?.service?.name || 'خدمة'}
                          </span>
                        </div>
                        {item.reservation_service?.reservation?.reservation_number && (
                          <p className="text-sm text-muted-foreground mb-2">
                            الحجز: {item.reservation_service.reservation.reservation_number}
                          </p>
                        )}
                        {(item.old_quantity || item.new_quantity) && (
                          <div className="text-sm text-muted-foreground">
                            الكمية: {item.old_quantity || '-'} → {item.new_quantity || '-'}
                          </div>
                        )}
                        {(item.old_price || item.new_price) && (
                          <div className="text-sm text-muted-foreground">
                            السعر: {item.old_price || '-'} → {item.new_price || '-'}
                          </div>
                        )}
                        {item.notes_ar && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.notes_ar}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDateShort(item.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد سجلات
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}

