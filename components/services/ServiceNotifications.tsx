'use client'

import { useServiceNotifications } from '@/lib/hooks/use-service-notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Package, Calendar, AlertTriangle } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'

export function ServiceNotifications() {
  const { data: notifications, isLoading } = useServiceNotifications()

  if (isLoading || !notifications || notifications.length === 0) {
    return null
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const getIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <Package className="h-4 w-4 text-orange-600" />
      case 'booking_reminder':
        return <Calendar className="h-4 w-4 text-blue-600" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          إشعارات الخدمات
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {notifications.slice(0, 5).map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-3 p-3 border rounded-lg ${
                !notification.is_read ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="mt-1">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{notification.title_ar}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {notification.message_ar}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateShort(notification.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

