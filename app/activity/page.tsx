'use client'

import { useActivityFeed } from '@/lib/hooks/use-activity'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Activity, Clock } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { useState } from 'react'

export default function ActivityPage() {
  const [resourceType, setResourceType] = useState<string>('all')

  const { data: activities, isLoading } = useActivityFeed({
    resourceType: resourceType !== 'all' ? resourceType : undefined,
    limit: 100,
  })

  const actionLabels: Record<string, string> = {
    created: 'إنشاء',
    updated: 'تحديث',
    deleted: 'حذف',
    checked_in: 'تسجيل دخول',
    checked_out: 'تسجيل خروج',
    payment_added: 'إضافة دفعة',
    attachment_uploaded: 'رفع مرفق',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Activity className="h-8 w-8" />
            سجل الأنشطة
          </h1>
          <p className="text-muted-foreground">تتبع جميع الأنشطة في النظام</p>
        </div>
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="جميع الموارد" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الموارد</SelectItem>
            <SelectItem value="reservations">حجوزات</SelectItem>
            <SelectItem value="units">وحدات</SelectItem>
            <SelectItem value="guests">ضيوف</SelectItem>
            <SelectItem value="payments">مدفوعات</SelectItem>
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
          ) : activities && activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {actionLabels[activity.action] || activity.action}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {activity.resource_type}
                      </span>
                    </div>
                    {activity.description_ar || activity.description ? (
                      <p className="text-sm text-muted-foreground mb-2">
                        {activity.description_ar || activity.description}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateShort(activity.created_at)}
                      </div>
                      {activity.user?.email && (
                        <span>بواسطة: {activity.user.email}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد أنشطة
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

