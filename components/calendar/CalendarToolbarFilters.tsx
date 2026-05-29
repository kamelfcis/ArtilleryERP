'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Bed,
  Crown,
  Trees,
  Layers,
  Castle,
  Check,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UNIT_TYPES } from '@/lib/constants'
import { useLocations } from '@/lib/hooks/use-locations'
import { useUnitTypesByLocation } from '@/lib/hooks/use-units'
import { useCurrentStaff } from '@/lib/hooks/use-staff'
import { useAuth } from '@/contexts/AuthContext'
import { useCalendarFilters } from '@/contexts/CalendarFilterContext'

const UNIT_TYPE_META = [
  { value: 'room', icon: Bed, color: 'text-blue-500', bg: 'from-blue-500/15 to-blue-600/10', ring: 'ring-blue-400/40' },
  { value: 'suite', icon: Crown, color: 'text-amber-500', bg: 'from-amber-500/15 to-orange-600/10', ring: 'ring-amber-400/40' },
  { value: 'chalet', icon: Trees, color: 'text-emerald-500', bg: 'from-emerald-500/15 to-green-600/10', ring: 'ring-emerald-400/40' },
  { value: 'duplex', icon: Layers, color: 'text-violet-500', bg: 'from-violet-500/15 to-purple-600/10', ring: 'ring-violet-400/40' },
  { value: 'villa', icon: Castle, color: 'text-rose-500', bg: 'from-rose-500/15 to-red-600/10', ring: 'ring-rose-400/40' },
  { value: 'apartment', icon: Building2, color: 'text-cyan-500', bg: 'from-cyan-500/15 to-teal-600/10', ring: 'ring-cyan-400/40' },
] as const

const HOVER_CLOSE_DELAY_MS = 180

type DropdownPosition = { top: number; left: number }

function useDropdownPosition(anchor: HTMLElement | null, open: boolean) {
  const [position, setPosition] = useState<DropdownPosition | null>(null)

  const updatePosition = useCallback(() => {
    if (!anchor) {
      setPosition(null)
      return
    }
    const rect = anchor.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    })
  }, [anchor])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onReposition = () => updatePosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updatePosition])

  return position
}

function UnitTypeDropdownPortal({
  anchor,
  open,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  anchor: HTMLElement | null
  open: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const position = useDropdownPosition(anchor, open)

  useEffect(() => setMounted(true), [])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && position && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="fixed z-[100] min-w-[200px]"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translateX(-50%)',
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export function CalendarToolbarFilters() {
  const { hasRole } = useAuth()
  const { data: currentStaff } = useCurrentStaff()
  const isStaffOnly = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')

  const {
    selectedLocation,
    setSelectedLocation,
    selectedTypes,
    toggleUnitType,
    clearUnitTypes,
  } = useCalendarFilters()

  const { data: locations, isLoading: locationsLoading } = useLocations()
  const { data: unitTypesRows } = useUnitTypesByLocation()

  const typesByLocation = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!unitTypesRows) return map
    for (const unit of unitTypesRows) {
      if (!unit.location_id) continue
      const existing = map.get(unit.location_id)
      if (existing) {
        if (!existing.includes(unit.type)) existing.push(unit.type)
      } else {
        map.set(unit.location_id, [unit.type])
      }
    }
    return map
  }, [unitTypesRows])

  const visibleLocations = useMemo(() => {
    if (isStaffOnly && currentStaff?.location_id) {
      return locations?.filter(l => l.id === currentStaff.location_id) ?? []
    }
    return locations ?? []
  }, [locations, isStaffOnly, currentStaff?.location_id])

  const staffLocationId = isStaffOnly ? currentStaff?.location_id : undefined

  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null)
  const [hoveredAnchor, setHoveredAnchor] = useState<HTMLElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setHoveredLocationId(null)
      setHoveredAnchor(null)
    }, HOVER_CLOSE_DELAY_MS)
  }, [clearCloseTimer])

  const openDropdown = useCallback((locationId: string, anchor?: HTMLElement) => {
    clearCloseTimer()
    setHoveredLocationId(locationId)
    if (anchor) setHoveredAnchor(anchor)
  }, [clearCloseTimer])

  const effectiveSelectedLocation = staffLocationId || selectedLocation

  const locationOptions = useMemo(() => {
    if (isStaffOnly) return visibleLocations
    return [{ id: 'all', name_ar: 'جميع المواقع', name: 'All locations' }, ...visibleLocations]
  }, [isStaffOnly, visibleLocations])

  const hoveredLocation = useMemo(() => {
    if (!hoveredLocationId) return null
    const location = locationOptions.find(l => l.id === hoveredLocationId)
    if (!location) return null
    const isAll = hoveredLocationId === 'all'
    const availableTypes = isAll
      ? [...new Set(unitTypesRows?.map(u => u.type) ?? [])]
      : typesByLocation.get(hoveredLocationId) ?? []
    if (availableTypes.length === 0) return null
    return { location, isAll, availableTypes, locId: hoveredLocationId }
  }, [hoveredLocationId, locationOptions, unitTypesRows, typesByLocation])

  if (locationsLoading) {
    return (
      <div className="flex items-center gap-2 px-2">
        <div className="h-9 w-24 rounded-full bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
        <div className="h-9 w-28 rounded-full bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2 min-w-0 w-full px-1">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full py-0.5">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 shrink-0 ps-1">
          <MapPin className="h-3.5 w-3.5" />
          الموقع
        </span>

        {locationOptions.map(location => {
          const locId = location.id
          const isAll = locId === 'all'
          const isActive = effectiveSelectedLocation === locId
          const availableTypes = isAll
            ? [...new Set(unitTypesRows?.map(u => u.type) ?? [])]
            : typesByLocation.get(locId) ?? []
          return (
            <div
              key={locId}
              className="relative shrink-0"
              onMouseEnter={e => openDropdown(locId, e.currentTarget)}
              onMouseLeave={scheduleClose}
            >
              <button
                type="button"
                onClick={() => {
                  if (isStaffOnly) return
                  setSelectedLocation(locId)
                  if (locId === 'all') clearUnitTypes()
                }}
                disabled={isStaffOnly && !isAll}
                className={cn(
                  'group relative flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-semibold',
                  'border backdrop-blur-md transition-all duration-200 ease-out',
                  'shadow-sm hover:shadow-md active:scale-[0.98]',
                  isActive
                    ? 'bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 text-white border-white/20 shadow-indigo-500/25'
                    : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300/70 dark:hover:border-indigo-600/50'
                )}
              >
                <Building2
                  className={cn(
                    'h-3.5 w-3.5 transition-colors',
                    isActive ? 'text-white/90' : 'text-indigo-500 dark:text-indigo-400'
                  )}
                />
                <span className="whitespace-nowrap max-w-[120px] sm:max-w-[160px] truncate">
                  {location.name_ar || location.name}
                </span>
                {!isAll && availableTypes.length > 0 && (
                  <span
                    className={cn(
                      'hidden md:inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      isActive
                        ? 'bg-white/20 text-white/90'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    )}
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    {availableTypes.length}
                  </span>
                )}
                {isActive && selectedTypes.length > 0 && (
                  <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md border border-white">
                    {selectedTypes.length}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <UnitTypeDropdownPortal
        anchor={hoveredLocation ? hoveredAnchor : null}
        open={!!hoveredLocation}
        onMouseEnter={() => {
          if (hoveredLocation) openDropdown(hoveredLocation.locId, hoveredAnchor ?? undefined)
        }}
        onMouseLeave={scheduleClose}
      >
        {hoveredLocation && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/80 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/40">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">نوع الوحدة</p>
            </div>
            <div className="p-1.5 space-y-0.5 max-h-[240px] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  if (!hoveredLocation.isAll) setSelectedLocation(hoveredLocation.locId)
                  clearUnitTypes()
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm transition-colors',
                  selectedTypes.length === 0
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300'
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded-md border flex items-center justify-center shrink-0',
                    selectedTypes.length === 0
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'border-slate-300 dark:border-slate-600'
                  )}
                >
                  {selectedTypes.length === 0 && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span>جميع الأنواع</span>
              </button>
              {UNIT_TYPE_META.filter(t => hoveredLocation.availableTypes.includes(t.value)).map(typeOption => {
                const isSelected = selectedTypes.includes(typeOption.value)
                const IconComp = typeOption.icon
                const label = UNIT_TYPES[typeOption.value as keyof typeof UNIT_TYPES] || typeOption.value
                return (
                  <button
                    key={typeOption.value}
                    type="button"
                    onClick={() =>
                      toggleUnitType(
                        typeOption.value,
                        hoveredLocation.isAll ? undefined : hoveredLocation.locId
                      )
                    }
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm transition-all duration-150',
                      isSelected
                        ? `bg-gradient-to-r ${typeOption.bg} font-semibold ring-1 ${typeOption.ring}`
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    <span
                      className={cn(
                        'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                        isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-600'
                      )}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <IconComp className={cn('h-4 w-4', typeOption.color)} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </UnitTypeDropdownPortal>
    </div>
  )
}
