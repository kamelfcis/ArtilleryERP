'use client'

import { useMemo } from 'react'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type LocationOption = {
  id: string
  name_ar?: string | null
  name?: string | null
}

interface LocationMultiSelectProps {
  locations: LocationOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  className?: string
}

function locationLabel(location: LocationOption) {
  return location.name_ar || location.name || '—'
}

export function LocationMultiSelect({
  locations,
  selectedIds,
  onChange,
  disabled,
  className,
}: LocationMultiSelectProps) {
  const displayLabel = useMemo(() => {
    if (selectedIds.length === 0) return 'جميع المواقع'
    if (selectedIds.length === 1) {
      const loc = locations.find(l => l.id === selectedIds[0])
      return loc ? locationLabel(loc) : 'موقع واحد'
    }
    if (selectedIds.length === 2) {
      const names = selectedIds
        .map(id => locations.find(l => l.id === id))
        .filter(Boolean)
        .map(l => locationLabel(l!))
      return names.join('، ')
    }
    return `${selectedIds.length} مواقع`
  }, [locations, selectedIds])

  function toggleLocation(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          dir="rtl"
          className={cn(
            'w-full h-10 justify-between font-normal px-3 bg-background hover:bg-accent/50',
            className
          )}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <Building2 className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="truncate text-right">{displayLabel}</span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0 mr-2">
            {selectedIds.length > 2 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                {selectedIds.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1.5 max-h-72 overflow-y-auto"
        align="start"
        dir="rtl"
      >
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
            selectedIds.length === 0 && 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
          )}
        >
          <span>جميع المواقع</span>
          {selectedIds.length === 0 && <Check className="h-4 w-4 text-indigo-600" />}
        </button>
        <div className="my-1 h-px bg-border" />
        {locations.map(location => {
          const isSelected = selectedIds.includes(location.id)
          return (
            <button
              key={location.id}
              type="button"
              onClick={() => toggleLocation(location.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                isSelected && 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
              )}
            >
              <span className="truncate text-right">{locationLabel(location)}</span>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
