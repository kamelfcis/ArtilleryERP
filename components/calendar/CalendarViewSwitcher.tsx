'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, Grid3x3, List } from 'lucide-react'

type ViewType = 'timeline' | 'day' | 'week' | 'month' | 'resourceTimeline'

interface CalendarViewSwitcherProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function CalendarViewSwitcher({
  currentView,
  onViewChange,
}: CalendarViewSwitcherProps) {
  const views: { type: ViewType; label: string; icon: any }[] = [
    { type: 'resourceTimeline', label: 'الجدول الزمني', icon: Grid3x3 },
    { type: 'day', label: 'يوم', icon: Calendar },
    { type: 'week', label: 'أسبوع', icon: Calendar },
    { type: 'month', label: 'شهر', icon: Calendar },
  ]

  return (
    <div className="flex gap-2">
      {views.map((view) => {
        const Icon = view.icon
        return (
          <Button
            key={view.type}
            variant={currentView === view.type ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewChange(view.type)}
          >
            <Icon className="mr-2 h-4 w-4" />
            {view.label}
          </Button>
        )
      })}
    </div>
  )
}

