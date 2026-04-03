'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useUnits } from '@/lib/hooks/use-units'
import { useReservations } from '@/lib/hooks/use-reservations'
import { formatDateShort } from '@/lib/utils'
import { Sparkles, CheckCircle, Clock } from 'lucide-react'

type HousekeepingStatus = 'clean' | 'dirty' | 'inspected' | 'maintenance'

export default function HousekeepingPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: units } = useUnits()
  const { data: reservations } = useReservations({
    status: 'checked_out',
  })

  // Get recently checked out units that need cleaning
  const unitsNeedingCleaning = units?.filter(unit => {
    const recentCheckout = reservations?.find(
      r => r.unit_id === unit.id && 
      new Date(r.check_out_date) >= new Date(Date.now() - 24 * 60 * 60 * 1000)
    )
    return recentCheckout || unit.status === 'maintenance'
  }) || []

  const updateHousekeepingStatus = useMutation({
    mutationFn: async ({
      unitId,
      status,
    }: {
      unitId: string
      status: HousekeepingStatus
    }) => {
      // In production, create a housekeeping_status table
      // For now, we'll update unit status
      const statusMap: Record<HousekeepingStatus, string> = {
        clean: 'available',
        dirty: 'maintenance',
        inspected: 'available',
        maintenance: 'maintenance',
      }

      const { error } = await supabase
        .from('units')
        .update({ status: statusMap[status] })
        .eq('id', unitId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      toast({
        title: 'نجح',
        description: 'تم تحديث حالة التنظيف',
      })
    },
  })

  function handleStatusChange(unitId: string, status: HousekeepingStatus) {
    updateHousekeepingStatus.mutate({ unitId, status })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8" />
          إدارة النظافة
        </h1>
        <p className="text-muted-foreground">تتبع وتنظيم أعمال النظافة</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>الوحدات التي تحتاج تنظيف</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="فلترة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="dirty">تحتاج تنظيف</SelectItem>
                <SelectItem value="clean">نظيفة</SelectItem>
                <SelectItem value="inspected">تم التفتيش</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {unitsNeedingCleaning.map((unit) => {
              const recentReservation = reservations?.find(r => r.unit_id === unit.id)
              return (
                <Card key={unit.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {unit.unit_number} - {unit.name_ar || unit.name}
                    </CardTitle>
                    {recentReservation && (
                      <p className="text-sm text-muted-foreground">
                        تسجيل خروج: {formatDateShort(recentReservation.check_out_date)}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStatusChange(unit.id, 'clean')}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        نظيفة
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleStatusChange(unit.id, 'inspected')}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        تم التفتيش
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {unitsNeedingCleaning.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                لا توجد وحدات تحتاج تنظيف
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

