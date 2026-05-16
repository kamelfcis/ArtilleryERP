'use client'

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import { useCalendarReservations, fetchCalendarWindow, calendarWindowKey, useCreateReservation, useUpdateReservation, useDeleteReservation } from '@/lib/hooks/use-reservations'
import type { CalendarEvent as CalendarEventRow, CalendarWindowArgs } from '@/lib/types/calendar'
import { useOfflineMutation, useIsOnline } from '@/lib/offline/use-offline-mutation'
import { useSyncEngine } from '@/lib/offline/sync-engine'
import { db } from '@/lib/offline/db'
import { OfflineBanner } from '@/components/offline/OfflineBanner'
import { ConflictResolutionSheet } from '@/components/offline/ConflictResolutionSheet'
import { useUnits } from '@/lib/hooks/use-units'
import { useLocations } from '@/lib/hooks/use-locations'
import { useCurrentStaff, useStaffList } from '@/lib/hooks/use-staff'
import { useAuth } from '@/contexts/AuthContext'
import { useReservationsRealtime } from '@/lib/hooks/use-realtime'
import { useGuests, useCreateGuest } from '@/lib/hooks/use-guests'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Reservation } from '@/lib/types/database'
import { useCreateBookingNotification } from '@/lib/hooks/use-booking-notifications'
import { RefreshCw, RotateCcw, Search, UserPlus, Users, Home, Phone, Mail, User, Trash2, AlertTriangle, Calendar, CalendarDays, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, Building2, Hotel, Mountain, Layers, Building, Bed, DoorOpen, Crown, Trees, Split, Castle, Sparkles, Menu, Check, Filter, ArrowLeftRight, FileText } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { useQueryClient, useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import { fetchWithSupabaseAuth } from '@/lib/api/fetch-with-supabase-auth'
import { supabase } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { useSidebar } from '@/contexts/SidebarContext'
import '@/app/calendar/calendar-styles.css'
import { DeleteReservationDialog } from '@/components/calendar/dialogs/DeleteReservationDialog'
import { RoomBlockDialog } from '@/components/calendar/dialogs/RoomBlockDialog'
import { ConfirmChangeDialog } from '@/components/calendar/dialogs/ConfirmChangeDialog'
import { ChangeUnitDialog } from '@/components/calendar/dialogs/ChangeUnitDialog'
import { CreateReservationDialog } from '@/components/calendar/dialogs/CreateReservationDialog'
import { CalendarFilterSheet } from '@/components/calendar/CalendarFilterSheet'
import FullCalendarWidget from '@/components/calendar/FullCalendarWidget'
import {
  getStatusColor,
  getUnitTypeIcon,
} from '@/lib/utils/calendar-helpers'

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const [headerExpanded, setHeaderExpanded] = useState(true)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toggle: toggleSidebar, collapsed: sidebarCollapsed } = useSidebar()
  const [selectedLocation, setSelectedLocationState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('calendar-selected-location') || 'all'
    }
    return 'all'
  })
  const setSelectedLocation = (value: string) => {
    setSelectedLocationState(value)
    localStorage.setItem('calendar-selected-location', value)
  }
  // Helper to get today's date as YYYY-MM-DD string
  const getTodayString = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Date range state with localStorage persistence
  const [rangeStart, setRangeStartState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-range-start')
      if (saved) return saved
    }
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [rangeEnd, setRangeEndState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-range-end')
      if (saved) return saved
    }
    const d = new Date()
    d.setMonth(d.getMonth() + 3)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const setRangeStart = (value: string) => {
    setRangeStartState(value)
    localStorage.setItem('calendar-range-start', value)
  }
  const setRangeEnd = (value: string) => {
    setRangeEndState(value)
    localStorage.setItem('calendar-range-end', value)
  }

  // Shift both rangeStart and rangeEnd by `days` (e.g. +1 or -1), keeping the same duration
  const shiftRange = (days: number) => {
    const start = new Date(rangeStart)
    const end = new Date(rangeEnd)
    start.setDate(start.getDate() + days)
    end.setDate(end.getDate() + days)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setRangeStart(fmt(start))
    setRangeEnd(fmt(end))
  }

  const [selectedTypes, setSelectedTypesState] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-selected-types')
      if (saved) {
        try { return JSON.parse(saved) } catch { return [] }
      }
    }
    return []
  })
  const setSelectedTypes = (value: string[] | ((prev: string[]) => string[])) => {
    setSelectedTypesState(prev => {
      const next = typeof value === 'function' ? value(prev) : value
      localStorage.setItem('calendar-selected-types', JSON.stringify(next))
      return next
    })
  }
  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [currentView, setCurrentView] = useState<'timeline' | 'day' | 'week' | 'month' | 'resourceTimeline'>('resourceTimeline')
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reservationToDelete, setReservationToDelete] = useState<CalendarEventRow | null>(null)
  const [blockDeleteDialogOpen, setBlockDeleteDialogOpen] = useState(false)
  const [blockToDelete, setBlockToDelete] = useState<any>(null)
  const [isUpdatingStatuses, setIsUpdatingStatuses] = useState(false)

  const [pendingEventChange, setPendingEventChange] = useState<{
    type: 'drop' | 'resize'
    info: any
    description: string
    reservationId: string
    newStartDate?: string
    newEndDate?: string
    newUnitId?: string
  } | null>(null)
  const [changeUnitReservation, setChangeUnitReservation] = useState<CalendarEventRow | null>(null)
  const [changeUnitDialogOpen, setChangeUnitDialogOpen] = useState(false)
  const [changingUnit, setChangingUnit] = useState(false)
  const [changeUnitSearch, setChangeUnitSearch] = useState('')
  const [pendingReservation, setPendingReservation] = useState<{
    unitId: string
    checkIn: string
    checkOut: string
  } | null>(null)
  const [newGuestCreated, setNewGuestCreated] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [calendarDirection, setCalendarDirection] = useState<'rtl' | 'ltr'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('calendar-direction') as 'rtl' | 'ltr') || 'rtl'
    }
    return 'rtl'
  })
  const toggleCalendarDirection = () => {
    setCalendarDirection(prev => {
      const next = prev === 'rtl' ? 'ltr' : 'rtl'
      localStorage.setItem('calendar-direction', next)
      return next
    })
  }

  // Apply direction changes via the FullCalendar API so the widget updates
  // in-place without a full remount.
  useEffect(() => {
    if (!calendarRef.current) return
    calendarRef.current.getApi().setOption('direction', calendarDirection)
  }, [calendarDirection])

  // Check if user is Staff-only (not admin/manager)
  const { hasRole, user, elevatedOps } = useAuth()
  const { data: currentStaff, isLoading: currentStaffLoading } = useCurrentStaff()
  const { data: allStaff } = useStaffList()
  const isStaffOnly = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')
  
  const { data: authUsersForCreator } = useQuery({
    queryKey: ['auth-users-for-calendar'],
    queryFn: async () => {
      const res = await fetchWithSupabaseAuth('/api/admin/users')
      if (!res.ok) return []
      const { users } = await res.json()
      return users as Array<{ id: string; email?: string }>
    },
    enabled: true,
  })

  // created_by_user_id is now inlined on every CalendarEventRow from vw_calendar_events.
  // The audit-logs-reservation-creators query is no longer needed.

  const staffByUserId = useMemo(() => {
    const map = new Map<string, string>()
    if (authUsersForCreator) {
      for (const u of authUsersForCreator) {
        if (u.email) map.set(u.id, u.email)
      }
    }
    if (allStaff) {
      for (const s of allStaff) {
        if (s.user_id) {
          map.set(s.user_id, `${s.first_name_ar || s.first_name} ${s.last_name_ar || s.last_name}`.trim())
        }
      }
    }
    return map
  }, [allStaff, authUsersForCreator])

  // For Staff users, force their location; for admins, use selected location
  const effectiveLocationId = isStaffOnly && currentStaff?.location_id 
    ? currentStaff.location_id 
    : (selectedLocation !== 'all' ? selectedLocation : undefined)

  const { data: locations, isLoading: locationsLoading } = useLocations()
  // Fetch all units for the location (no type filter) to derive available unit types for the dropdown.
  // onlyCalendarFields trims the select to slim columns — no nested images/facilities/location objects.
  const { data: allLocationUnits, isLoading: unitsLoading } = useUnits({
    locationId: effectiveLocationId,
    onlyCalendarFields: true,
  })
  
  // Filter units client-side by selected types
  const units = useMemo(() => {
    if (!allLocationUnits) return undefined
    if (selectedTypes.length === 0) return allLocationUnits
    return allLocationUnits.filter(u => selectedTypes.includes(u.type))
  }, [allLocationUnits, selectedTypes])

  // Compute available unit types from all units at this location
  const availableUnitTypes = useMemo(() => {
    if (!allLocationUnits) return []
    return [...new Set(allLocationUnits.map(u => u.type))]
  }, [allLocationUnits])
  const calendarArgs = useMemo<CalendarWindowArgs>(() => ({
    locationId: effectiveLocationId,
    start: rangeStart,
    end: rangeEnd,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
  }), [effectiveLocationId, rangeStart, rangeEnd, selectedStatus])

  const { data: reservations, isLoading: reservationsLoading } = useCalendarReservations(calendarArgs)

  // Real-time cache patches — mutates the cached window instead of invalidating it.
  useReservationsRealtime(calendarArgs)

  // Prefetch the previous and next calendar windows so navigation feels instant.
  useEffect(() => {
    if (!rangeStart || !rangeEnd) return
    if (!navigator.onLine) return
    const startDate = new Date(rangeStart)
    const endDate = new Date(rangeEnd)
    const durationMs = endDate.getTime() - startDate.getTime()
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const shift = (dir: -1 | 1): CalendarWindowArgs => {
      const s = new Date(rangeStart)
      const e = new Date(rangeEnd)
      s.setDate(s.getDate() + dir * durationDays)
      e.setDate(e.getDate() + dir * durationDays)
      return { ...calendarArgs, start: fmt(s), end: fmt(e) }
    }

    const prev = shift(-1)
    const next = shift(+1)
    queryClient.prefetchQuery({ queryKey: calendarWindowKey(prev), queryFn: () => fetchCalendarWindow(prev), staleTime: 60_000 })
    queryClient.prefetchQuery({ queryKey: calendarWindowKey(next), queryFn: () => fetchCalendarWindow(next), staleTime: 60_000 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd, effectiveLocationId, selectedStatus])
  const { data: guests } = useGuests()
  const createReservation = useCreateReservation()
  const createBookingNotif = useCreateBookingNotification()
  const createGuest = useCreateGuest()
  const updateReservation = useUpdateReservation()
  const deleteReservation = useDeleteReservation()

  // ── Offline / PWA ─────────────────────────────────────────────────────────
  const isOnline = useIsOnline()
  const offlineMutation = useOfflineMutation(calendarArgs)
  // Mount the sync engine — drains outbox and delta-pulls on reconnect.
  useSyncEngine(calendarArgs)
  const [conflictSheetOpen, setConflictSheetOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  // Set of outbox localIds — used to show pending badges on calendar events.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true
    let timerId: ReturnType<typeof setTimeout>

    const refresh = async () => {
      if (!mounted) return
      try {
        const entries = await db.outbox.toArray()
        if (mounted) {
          setPendingIds(new Set(entries.map(e => e.localId)))
          const hasConflicts = entries.some(e => e.conflict)
          if (hasConflicts) setConflictSheetOpen(true)
        }
        // Poll frequently when items are pending, slowly when the outbox is empty.
        if (mounted) timerId = setTimeout(refresh, entries.length > 0 ? 4000 : 30000)
      } catch {
        if (mounted) timerId = setTimeout(refresh, 30000)
      }
    }

    refresh()
    return () => { mounted = false; clearTimeout(timerId) }
  }, [])

  async function handleManualSync() {
    setIsSyncing(true)
    try {
      const { runSync } = await import('@/lib/offline/sync-engine')
      await runSync(queryClient, calendarArgs)
    } finally {
      setIsSyncing(false)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Room block delete mutation
  const deleteRoomBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('room_blocks')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-blocks'] })
      toast({
        title: 'نجح',
        description: 'تم حذف الحظر بنجاح',
      })
      setBlockDeleteDialogOpen(false)
      setBlockToDelete(null)
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف الحظر',
        variant: 'destructive',
      })
    },
  })

  // Fetch room blocks — scoped to the visible date range for efficiency.
  const { data: roomBlocks, isLoading: roomBlocksLoading } = useQuery({
    queryKey: ['room-blocks', rangeStart, rangeEnd],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_blocks')
        .select(`
          *,
          units:room_block_units (
            unit:units (
              id,
              unit_number,
              name,
              name_ar
            )
          )
        `)
        .lte('start_date', rangeEnd)
        .gte('end_date', rangeStart)
        .order('start_date', { ascending: false })

      if (error) throw error
      return data
    },
  })

  // Create a set of filtered unit IDs for quick lookup
  const filteredUnitIds = useMemo(() => {
    return new Set(units?.map(unit => unit.id) || [])
  }, [units])

  // Resources for resource-timeline view - each unit is a resource
  const resources = useMemo(() => {
    if (!units) return []
    
    // Filter by selected unit if specified
    const filteredByUnit = selectedUnit !== 'all' 
      ? units.filter(unit => unit.id === selectedUnit)
      : units
    
    // Sort by orderno (nulls last), then by unit_number
    const sorted = [...filteredByUnit].sort((a, b) => {
      const aOrder = (a as any).orderno
      const bOrder = (b as any).orderno
      if (aOrder != null && bOrder != null) return aOrder - bOrder
      if (aOrder != null) return -1
      if (bOrder != null) return 1
      return (a.unit_number || '').localeCompare(b.unit_number || '', undefined, { numeric: true })
    })
    
    return sorted.map(unit => {
      const Icon = getUnitTypeIcon(unit.type)
      return {
        id: unit.id,
        title: `${unit.unit_number} - ${unit.name_ar || unit.name || ''}`,
        orderno: (unit as any).orderno ?? 999999,
        extendedProps: {
          unit,
          icon: Icon,
          type: unit.type,
        },
      }
    })
  }, [units, selectedUnit])

      // Filter events to only show reservations for filtered units.
      // reservations is now CalendarEventRow[] — all guest/unit fields are flat.
      const reservationEvents = useMemo(() => {
        if (!reservations) return []

        return (reservations as CalendarEventRow[])
          .filter(reservation => filteredUnitIds.has(reservation.unit_id))
          .map(reservation => {
            const statusColor = getStatusColor(reservation.status)
            const unitNumber = reservation.unit_number || ''
            const guestName = `${reservation.guest_first_name_ar || reservation.guest_first_name || ''} ${reservation.guest_last_name_ar || reservation.guest_last_name || ''}`.trim() || ''
            const guestPhone = reservation.guest_phone || ''
            const createdAt = reservation.created_at
              ? new Date(reservation.created_at).toLocaleString('ar-EG', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true,
                })
              : ''
            const eventTitle = currentView === 'resourceTimeline'
              ? [guestName, guestPhone ? `📞 ${guestPhone}` : '', createdAt ? `🕐 ${createdAt}` : ''].filter(Boolean).join(' | ')
              : [unitNumber ? `${unitNumber} - ${guestName}` : guestName, guestPhone ? `📞 ${guestPhone}` : '', createdAt ? `🕐 ${createdAt}` : ''].filter(Boolean).join(' | ')

            return {
              id: reservation.id,
              title: eventTitle,
              start: reservation.check_in_date,
              end: reservation.check_out_date,
              resourceId: reservation.unit_id,
              backgroundColor: statusColor,
              borderColor: statusColor,
              classNames: [`status-${reservation.status}`],
              extendedProps: {
                reservation,
                status: reservation.status,
                unitNumber,
                guestPhone,
              },
            }
          })
      }, [reservations, filteredUnitIds, currentView])

      // Create events for room blocks with black color
      const roomBlockEvents = useMemo(() => {
        if (!roomBlocks) return []

        return roomBlocks
          .flatMap((block: any) => {
            // Get unit IDs from this block
            const blockUnitIds = block.units?.map((u: any) => u.unit?.id).filter(Boolean) || []
            
            // Only show blocks that have units matching our filter
            const hasMatchingUnits = blockUnitIds.some((unitId: string) => filteredUnitIds.has(unitId))
            if (!hasMatchingUnits) return []

            // Create one event per unit in the block
            return blockUnitIds
              .filter((unitId: string) => filteredUnitIds.has(unitId))
              .map((unitId: string) => {
                const unit = block.units.find((u: any) => u.unit?.id === unitId)?.unit
                const unitNumber = unit?.unit_number || ''
                // For resource timeline, show only block name (unit is already in resource column)
                const eventTitle = currentView === 'resourceTimeline' 
                  ? `🚫 ${block.name_ar || block.name}`
                  : (unitNumber ? `🚫 ${unitNumber} - ${block.name_ar || block.name}` : `🚫 ${block.name_ar || block.name}`)

                return {
                  id: `block-${block.id}-${unitId}`,
                  title: eventTitle,
                  start: block.start_date,
                  end: block.end_date,
                  resourceId: unitId, // Link event to resource (unit)
                  backgroundColor: '#000000', // Black color
                  borderColor: '#000000',
                  textColor: '#ffffff', // White text for visibility
                  classNames: ['room-block'],
                  extendedProps: {
                    roomBlock: block,
                    unitId: unitId,
                    unitNumber: unitNumber,
                  },
                }
              })
          })
      }, [roomBlocks, filteredUnitIds, currentView])

      // Maintenance events - full-range blocking events for units in maintenance
      const maintenanceEvents = useMemo(() => {
        if (!units) return []
        return units
          .filter(unit => unit.status === 'maintenance' && filteredUnitIds.has(unit.id))
          .map(unit => ({
            id: `maintenance-${unit.id}`,
            title: '🔧 صيانة',
            start: rangeStart,
            end: rangeEnd,
            resourceId: unit.id,
            backgroundColor: '#f59e0b',
            borderColor: '#d97706',
            textColor: '#000000',
            classNames: ['maintenance-block'],
            editable: false,
            extendedProps: {
              isMaintenance: true,
              unitId: unit.id,
              unitNumber: unit.unit_number,
            },
          }))
      }, [units, filteredUnitIds, rangeStart, rangeEnd])

      // Combine reservation, room block, and maintenance events
      const events = useMemo(() => {
        return [...reservationEvents, ...roomBlockEvents, ...maintenanceEvents]
      }, [reservationEvents, roomBlockEvents, maintenanceEvents])

  // Auto-update unit statuses when calendar page is opened — only when
  // we actually have internet. Otherwise skip and retry on reconnect.
  useEffect(() => {
    const run = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      updateUnitStatuses()
    }
    run()
    const onOnline = () => run()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run only once when component mounts

  // Function to update unit statuses
  async function updateUnitStatuses() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: 'غير متصل',
        description: 'سيتم التحديث عند عودة الاتصال',
      })
      return
    }
    try {
      setIsUpdatingStatuses(true)
      const response = await fetch('/api/admin/update-unit-statuses', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('فشل في تحديث الحالات')
      }

      const result = await response.json()
      
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      
      toast({
        title: 'نجح',
        description: result.message || 'تم تحديث حالات الوحدات بنجاح',
      })
    } catch (error: any) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Silent — we're offline; user will see this on reconnect.
        return
      }
      console.error('Error updating unit statuses:', error)
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث حالات الوحدات',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingStatuses(false)
    }
  }

  // (Debug filter logging removed — was noisy in dev console.)


  // Global: click anywhere hides open right-click tooltips
  useEffect(() => {
    const hideAllTooltips = () => {
      document.querySelectorAll('.fc-event-tooltip').forEach(el => {
        (el as HTMLElement).style.display = 'none'
      })
    }
    // Left-click anywhere dismisses tooltips
    document.addEventListener('click', hideAllTooltips)
    // Escape key also dismisses
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') hideAllTooltips() }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', hideAllTooltips)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Keyboard arrow keys: shift calendar range day-by-day
  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      // Don't interfere when user is typing in an input, select, or textarea
      const tag = (document.activeElement?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        shiftRange(-1) // RTL: right arrow = go back (earlier)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        shiftRange(1) // RTL: left arrow = go forward (later)
      }
    }
    document.addEventListener('keydown', handleArrowKeys)
    return () => document.removeEventListener('keydown', handleArrowKeys)
  }, [rangeStart, rangeEnd])


  const handleEventClick = useCallback(function handleEventClick(clickInfo: any) {
    // Ignore clicks on maintenance events
    if (clickInfo.event.extendedProps.isMaintenance) return

    // Handle room block events
    const roomBlock = clickInfo.event.extendedProps.roomBlock
    if (roomBlock) {
      setBlockToDelete(roomBlock)
      setBlockDeleteDialogOpen(true)
      return
    }

    // Handle reservation events - left click navigates to detail
    const reservation = clickInfo.event.extendedProps.reservation as CalendarEventRow
    if (reservation?.id) {
      router.push(`/reservations/${reservation.id}`)
    }
  }, [router, setBlockToDelete, setBlockDeleteDialogOpen])

  async function handleDeleteReservation() {
    if (!reservationToDelete) return

    if (!isOnline) {
      // Queue delete in outbox and patch cache optimistically.
      try {
        await offlineMutation.remove(reservationToDelete.id)
        toast({ title: 'محفوظ للمزامنة', description: 'سيُحذف الحجز عند استعادة الاتصال.' })
      } catch (err: any) {
        toast({ title: 'خطأ', description: err.message, variant: 'destructive' })
      }
      setDeleteDialogOpen(false)
      setReservationToDelete(null)
      return
    }

    deleteReservation.mutate(reservationToDelete.id, {
      onSuccess: () => {
        toast({
          title: 'نجح',
          description: 'تم حذف الحجز بنجاح',
        })
        setDeleteDialogOpen(false)
        setReservationToDelete(null)
      },
      onError: (error: any) => {
        toast({
          title: 'خطأ',
          description: error.message || 'فشل في حذف الحجز',
          variant: 'destructive',
        })
      },
    })
  }

  const handleDateSelect = useCallback(async function handleDateSelect(selectInfo: any) {
    // Get the resource (unit) ID if selecting from timeline view
    const resourceId = selectInfo.resource?.id || ''

    // Block reservation on maintenance units
    if (resourceId) {
      const selectedUnitObj = units?.find(u => u.id === resourceId)
      if (selectedUnitObj?.status === 'maintenance') {
        toast({
          title: 'غير مسموح',
          description: 'هذه الوحدة قيد الصيانة ولا يمكن الحجز عليها',
          variant: 'destructive',
        })
        selectInfo.view.calendar.unselect()
        return
      }
    }
    
    // Store pending reservation dates and unit
    setPendingReservation({
      unitId: resourceId, // Pre-selected unit from calendar
      checkIn: selectInfo.startStr,
      checkOut: selectInfo.endStr,
    })
    
    // Open guest dialog
    setGuestDialogOpen(true)
    
    // Unselect the date range
    selectInfo.view.calendar.unselect()

    // Clear the live nights counter in the navbar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calendar:drag-nights', { detail: { nights: 0 } }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, calendarArgs])

  async function handleCreateReservation(guestId: string, unitIds: string[], notes: string, checkIn: string, checkOut: string) {
    if (unitIds.length === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار وحدة واحدة على الأقل',
        variant: 'destructive',
      })
      return
    }

    // Close selection dialog immediately — optimistic update will paint the calendar
    setGuestDialogOpen(false)
    setPendingReservation(null)

    const selectedGuest = guests?.find(g => g.id === guestId)
    if (!selectedGuest) {
      toast({ title: 'خطأ', description: 'الضيف غير موجود', variant: 'destructive' })
      return
    }

    const { calculateReservationPrice } = await import('@/lib/utils/pricing')
    const unitMap = new Map((units || []).map(u => [u.id, u]))
    const uniqueUnitIds = Array.from(new Set(unitIds))
    const isOnline = typeof navigator === 'undefined' || navigator.onLine
    const isRestrictedBM =
      hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps

    // Run all per-unit creates in parallel so N units take ≈ time of the slowest one
    const results = await Promise.allSettled(
      uniqueUnitIds.map(async (unitId) => {
        const unit = unitMap.get(unitId)
        if (!unit) throw new Error(`الوحدة ${unitId} غير موجودة`)

        // Fetch pricing only when online; offline falls back to unit base price
        let pricingData: any[] | null = null
        if (isOnline) {
          const { data, error: pricingError } = await supabase
            .from('pricing')
            .select('*')
            .eq('unit_id', unitId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
          if (pricingError) console.error('Error fetching pricing:', pricingError)
          pricingData = data
        }

        const totalAmount = await calculateReservationPrice(
          {
            unitId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            unitType: unit.type,
            guestType: selectedGuest.guest_type,
          },
          (pricingData || []) as any[]
        )

        const result = await offlineMutation.create({
          unit_id: unitId,
          guest_id: guestId,
          check_in_date: checkIn,
          check_out_date: checkOut,
          status: 'pending',
          source: 'online',
          total_amount: totalAmount,
          adults: 1,
          children: 0,
          notes: notes || null,
          ...(user?.id ? { created_by: user.id } : {}),
        } as any)

        // Fire-and-forget booking notification for restricted branch managers
        if (isRestrictedBM && user?.id && result?.id && isOnline) {
          const gName = `${selectedGuest.first_name_ar || selectedGuest.first_name} ${selectedGuest.last_name_ar || selectedGuest.last_name}`
          const loc = locations?.find(l => l.id === unit.location_id)
          const lName = loc ? (loc.name_ar || loc.name) : ''
          const nights = Math.ceil(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
          )
          createBookingNotif.mutate({
            reservation_id: result.id,
            created_by: user.id,
            message: `📋 حجز جديد من ${user.email || 'مدير فرع'} | الضيف: ${gName} | الوحدة: ${unit.unit_number} — ${lName} | ${checkIn} إلى ${checkOut} (${nights} ليلة) | المبلغ: ${totalAmount} ج.م`,
          })
        }

        return totalAmount
      })
    )

    const successCount = results.filter(r => r.status === 'fulfilled').length
    const totalAmountSum = results.reduce(
      (s, r) => s + (r.status === 'fulfilled' ? (r.value as number) : 0),
      0
    )

    if (successCount > 0) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      toast({
        title: offline ? 'محفوظ للمزامنة' : 'نجح',
        description: offline
          ? (successCount === 1
            ? `تم حفظ الحجز محلياً. سيُرسل عند عودة الاتصال. المبلغ: ${formatCurrency(totalAmountSum)}`
            : `تم حفظ ${successCount} حجوزات محلياً. ستُرسل عند عودة الاتصال. المبلغ: ${formatCurrency(totalAmountSum)}`)
          : (successCount === 1
            ? `تم إنشاء الحجز بنجاح. المبلغ الإجمالي: ${formatCurrency(totalAmountSum)}`
            : `تم إنشاء ${successCount} حجوزات بنجاح. المبلغ الإجمالي: ${formatCurrency(totalAmountSum)}`),
      })
    }

    const failCount = results.filter(r => r.status === 'rejected').length
    if (failCount > 0) {
      toast({
        title: 'تحذير',
        description: `فشل إنشاء ${failCount} حجز. يرجى المحاولة مجدداً.`,
        variant: 'destructive',
      })
    }

    setNewGuestCreated(null)
  }

  function handleGuestCreated() {
    // Refresh guests list after guest creation
    queryClient.invalidateQueries({ queryKey: ['guests'] })
  }

  const handleEventDrop = useCallback(function handleEventDrop(dropInfo: any) {
    const reservation = dropInfo.event.extendedProps.reservation as CalendarEventRow
    if (!reservation) return

    const newStartDate = dropInfo.event.startStr
    const newEndDate = dropInfo.event.endStr
    const newResource = dropInfo.newResource
    const newUnitId = newResource ? newResource.id : reservation.unit_id

    // Block drop onto maintenance units
    const targetUnit = units?.find(u => u.id === newUnitId)
    if (targetUnit?.status === 'maintenance') {
      toast({
        title: 'غير مسموح',
        description: 'هذه الوحدة قيد الصيانة ولا يمكن نقل الحجز إليها',
        variant: 'destructive',
      })
      dropInfo.revert()
      return
    }

    const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' })

    let description = ''
    if (newResource && newUnitId !== reservation.unit_id) {
      const oldUnit = units?.find((u: any) => u.id === reservation.unit_id)
      description = `نقل الحجز من وحدة ${oldUnit?.unit_number || ''} إلى وحدة ${newResource.title}\nالتاريخ: ${fmtDate(newStartDate)} - ${fmtDate(newEndDate)}`
    } else {
      description = `تغيير تاريخ الحجز من ${fmtDate(reservation.check_in_date)} - ${fmtDate(reservation.check_out_date)} إلى ${fmtDate(newStartDate)} - ${fmtDate(newEndDate)}`
    }

    setPendingEventChange({ type: 'drop', info: dropInfo, description, reservationId: reservation.id, newStartDate, newEndDate, newUnitId })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, toast])

  const handleEventResize = useCallback(function handleEventResize(resizeInfo: any) {
    const reservation = resizeInfo.event.extendedProps.reservation as CalendarEventRow
    if (!reservation) return

    const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' })
    const newStartDate = resizeInfo.event.startStr
    const newEndDate = resizeInfo.event.endStr

    const startChanged = newStartDate !== reservation.check_in_date
    const endChanged = newEndDate !== reservation.check_out_date

    let description = ''
    if (startChanged && endChanged) {
      description = `تعديل الحجز: من ${fmtDate(reservation.check_in_date)}-${fmtDate(reservation.check_out_date)} إلى ${fmtDate(newStartDate)}-${fmtDate(newEndDate)}`
    } else if (startChanged) {
      description = `تعديل تاريخ الدخول: من ${fmtDate(reservation.check_in_date)} إلى ${fmtDate(newStartDate)}`
    } else {
      description = `تمديد / تقصير الحجز: تاريخ الخروج من ${fmtDate(reservation.check_out_date)} إلى ${fmtDate(newEndDate)}`
    }

    setPendingEventChange({ type: 'resize', info: resizeInfo, description, reservationId: reservation.id, newStartDate, newEndDate })
  }, [])

  async function confirmEventChange() {
    if (!pendingEventChange) return
    const { type, info, reservationId, newStartDate, newEndDate, newUnitId } = pendingEventChange

    if (type === 'drop') {
      const reservation = info.event.extendedProps.reservation as CalendarEventRow
      const unitChanged = newUnitId && newUnitId !== reservation.unit_id

      try {
        // Check if the unit changed (dragged to a different resource)
        if (unitChanged && newUnitId) {
          // Check availability for the new unit
          const { data: conflictingReservations, error: checkError } = await supabase
            .from('reservations')
            .select('id')
            .eq('unit_id', newUnitId)
            .neq('id', reservationId)
            .neq('status', 'cancelled')
            .neq('status', 'no_show')
            .or(`and(check_in_date.lt.${newEndDate},check_out_date.gt.${newStartDate})`)

          if (checkError) throw checkError

          if (conflictingReservations && conflictingReservations.length > 0) {
            toast({
              title: 'الوحدة غير متاحة',
              description: 'يوجد حجز آخر في هذه الوحدة خلال الفترة المحددة',
              variant: 'destructive',
            })
            info.revert()
            setPendingEventChange(null)
            return
          }

          // Check for room blocks
          const { data: conflictingBlocks, error: blockError } = await supabase
            .from('room_block_units')
            .select(`
              room_block:room_blocks!inner (
                start_date,
                end_date
              )
            `)
            .eq('unit_id', newUnitId)

          if (blockError) throw blockError

          const hasBlockConflict = conflictingBlocks?.some((block: any) => {
            const blockStart = new Date(block.room_block.start_date)
            const blockEnd = new Date(block.room_block.end_date)
            const resStart = new Date(newStartDate!)
            const resEnd = new Date(newEndDate!)
            return resStart < blockEnd && resEnd > blockStart
          })

          if (hasBlockConflict) {
            toast({
              title: 'الوحدة محجوبة',
              description: 'هذه الوحدة محجوبة خلال الفترة المحددة',
              variant: 'destructive',
            })
            info.revert()
            setPendingEventChange(null)
            return
          }
        }

        // Update the reservation with captured dates and possibly new unit
        if (!isOnline) {
          await offlineMutation.update({
            id: reservationId,
            check_in_date: newStartDate,
            check_out_date: newEndDate,
            ...(unitChanged ? { unit_id: newUnitId } : {}),
          })
          const newUnit = unitChanged ? units?.find(u => u.id === newUnitId) : null
          toast({ title: 'محفوظ للمزامنة', description: unitChanged ? `سيُنقل الحجز إلى ${newUnit?.unit_number || newUnitId} عند الاتصال` : 'سيُحدَّث الحجز عند الاتصال.' })
        } else {
          await updateReservation.mutateAsync({
            id: reservationId,
            check_in_date: newStartDate,
            check_out_date: newEndDate,
            ...(unitChanged ? { unit_id: newUnitId } : {}),
          })
          const newUnit = unitChanged ? units?.find(u => u.id === newUnitId) : null
          toast({
            title: 'نجح',
            description: unitChanged
              ? `تم نقل الحجز إلى ${newUnit?.unit_number || newUnitId} وتحديث التواريخ`
              : 'تم تحديث الحجز بنجاح',
          })
        }
      } catch (error) {
        console.error('Error updating reservation:', error)
        toast({
          title: 'خطأ',
          description: 'فشل في تحديث الحجز',
          variant: 'destructive',
        })
        info.revert()
      }
    } else if (type === 'resize') {
      try {
        // Use captured dates — update both check_in and check_out to handle resize from either side
        if (!isOnline) {
          await offlineMutation.update({ id: reservationId, check_in_date: newStartDate, check_out_date: newEndDate })
          toast({ title: 'محفوظ للمزامنة', description: 'سيُحدَّث الحجز عند استعادة الاتصال.' })
        } else {
          await updateReservation.mutateAsync({
            id: reservationId,
            check_in_date: newStartDate,
            check_out_date: newEndDate,
          })
          toast({
            title: 'نجح',
            description: 'تم تحديث الحجز بنجاح',
          })
        }
      } catch (error) {
        toast({
          title: 'خطأ',
          description: 'فشل في تحديث الحجز',
          variant: 'destructive',
        })
        info.revert()
      }
    }

    setPendingEventChange(null)
  }

  function cancelEventChange() {
    if (pendingEventChange) {
      pendingEventChange.info.revert()
      setPendingEventChange(null)
    }
  }

  async function handleChangeUnit(newUnitId: string) {
    if (!changeUnitReservation) return
    setChangingUnit(true)
    const res = changeUnitReservation
    const newUnit = units?.find(u => u.id === newUnitId)

    try {
      // Check if the target unit is in maintenance
      if (newUnit?.status === 'maintenance') {
        toast({
          title: 'خطأ',
          description: `الوحدة ${newUnit.unit_number} قيد الصيانة ولا يمكن نقل الحجز إليها.`,
          variant: 'destructive',
        })
        return
      }

      // Check for conflicting reservations
      const { data: conflictingReservations, error: checkError } = await supabase
        .from('reservations')
        .select('id')
        .eq('unit_id', newUnitId)
        .neq('id', res.id)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .or(`and(check_in_date.lt.${res.check_out_date},check_out_date.gt.${res.check_in_date})`)

      if (checkError) throw checkError

      if (conflictingReservations && conflictingReservations.length > 0) {
        toast({
          title: 'الوحدة غير متاحة',
          description: 'يوجد حجز آخر في هذه الوحدة خلال الفترة المحددة',
          variant: 'destructive',
        })
        return
      }

      // Check for room block conflicts
      const { data: conflictingBlocks, error: blockError } = await supabase
        .from('room_block_units')
        .select(`
          room_block:room_blocks!inner (
            start_date,
            end_date
          )
        `)
        .eq('unit_id', newUnitId)

      if (blockError) throw blockError

      const hasBlockConflict = conflictingBlocks?.some((block: any) => {
        const blockStart = new Date(block.room_block.start_date)
        const blockEnd = new Date(block.room_block.end_date)
        const resStart = new Date(res.check_in_date)
        const resEnd = new Date(res.check_out_date)
        return resStart < blockEnd && resEnd > blockStart
      })

      if (hasBlockConflict) {
        toast({
          title: 'الوحدة محجوبة',
          description: 'هذه الوحدة محجوبة خلال الفترة المحددة',
          variant: 'destructive',
        })
        return
      }

      // All clear — update the reservation
      await updateReservation.mutateAsync({
        id: res.id,
        unit_id: newUnitId,
      })

      queryClient.invalidateQueries({ queryKey: ['reservations'] })

      toast({
        title: 'نجح',
        description: `تم نقل الحجز إلى الوحدة ${newUnit?.unit_number || newUnitId}`,
      })

      setChangeUnitDialogOpen(false)
      setChangeUnitReservation(null)
    } catch (error: any) {
      console.error('Error changing unit:', error)
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في نقل الحجز',
        variant: 'destructive',
      })
    } finally {
      setChangingUnit(false)
    }
  }

  const staffProfileLoading =
    isStaffOnly && Boolean(user?.id) && currentStaffLoading

  const calendarDataLoading =
    unitsLoading ||
    reservationsLoading ||
    roomBlocksLoading ||
    staffProfileLoading

  if (calendarDataLoading) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20 min-h-0">
        <div className="flex-1 overflow-auto px-2 pb-2 pt-2 min-h-0">
          <div
            className="h-full min-h-[600px] rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 shadow-xl backdrop-blur-xl flex flex-col overflow-hidden"
            aria-busy
            aria-label="جاري تحميل التقويم"
          >
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-3 py-2.5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-slate-900/40">
              <div className="flex items-center gap-2 min-w-0">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-5 w-36 max-w-full" />
                  <Skeleton className="h-3 w-52 max-w-full hidden sm:block" />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Skeleton className="h-9 w-20 rounded-lg hidden sm:block" />
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>

            <div className="flex-1 min-h-0 flex">
              <div className="w-[200px] sm:w-[260px] md:w-[280px] flex-shrink-0 border-e border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/50 p-2 sm:p-3 space-y-2 overflow-hidden">
                <Skeleton className="h-5 w-16 mx-auto rounded-md" />
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>

              <div className="flex-1 min-w-0 flex flex-col p-2 sm:p-3 gap-2 overflow-hidden">
                <div className="flex gap-1 sm:gap-1.5 overflow-hidden pb-1">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-12 sm:h-14 flex-1 min-w-[56px] sm:min-w-[72px] rounded-md"
                    />
                  ))}
                </div>
                <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-hidden">
                  {Array.from({ length: 8 }).map((_, row) => (
                    <div key={row} className="flex gap-1 sm:gap-1.5 flex-1 min-h-[44px]">
                      {Array.from({ length: 16 }).map((_, col) => (
                        <Skeleton
                          key={col}
                          className="flex-1 min-w-[56px] sm:min-w-[72px] rounded-sm opacity-50"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20 min-h-0">
      {/* Offline banner — appears when offline or when pending outbox entries exist */}
      <OfflineBanner onSyncRequest={handleManualSync} syncing={isSyncing} />
      {/* Conflict resolution sheet — opens automatically when sync conflicts are detected */}
      <ConflictResolutionSheet
        open={conflictSheetOpen}
        onOpenChange={setConflictSheetOpen}
      />
      {/* Floating Direction Toggle Button */}
      <motion.div
        className="fixed bottom-24 right-6 z-50 no-print"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={toggleCalendarDirection}
            className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-700 text-white shadow-xl hover:shadow-2xl transition-all border-2 border-white/20 backdrop-blur-md relative overflow-hidden group"
            size="icon"
            title={calendarDirection === 'rtl' ? 'تبديل إلى يسار لليمين' : 'تبديل إلى يمين لليسار'}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <ArrowLeftRight className="h-5 w-5 relative z-10" />
            {/* Direction indicator */}
            <span className="absolute -top-1 -right-1 px-1 min-w-[20px] h-[18px] rounded-full bg-white text-[9px] font-bold text-teal-700 border border-teal-300 shadow-sm z-20 flex items-center justify-center">
              {calendarDirection === 'rtl' ? 'ي' : 'ش'}
            </span>
          </Button>
        </motion.div>
      </motion.div>

      {/* Floating Filter Button + Sheet Drawer */}
      <CalendarFilterSheet
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
        selectedUnit={selectedUnit}
        setSelectedUnit={setSelectedUnit}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        rangeStart={rangeStart}
        setRangeStart={setRangeStart}
        rangeEnd={rangeEnd}
        setRangeEnd={setRangeEnd}
        shiftRange={shiftRange}
        getTodayString={getTodayString}
        locations={locations}
        units={units}
        availableUnitTypes={availableUnitTypes}
        isStaffOnly={isStaffOnly}
        currentStaff={currentStaff}
        isUpdatingStatuses={isUpdatingStatuses}
        updateUnitStatuses={updateUnitStatuses}
        currentView={currentView}
        setCurrentView={setCurrentView}
        calendarRef={calendarRef}
      />

      {/* Full Calendar Widget */}
      <FullCalendarWidget
        ref={calendarRef}
        resources={resources}
        events={events}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        calendarDirection={calendarDirection}
        currentView={currentView}
        pendingIds={pendingIds}
        hasRole={hasRole}
        elevatedOps={elevatedOps}
        staffByUserId={staffByUserId}
        onDateSelect={handleDateSelect}
        onEventClick={handleEventClick}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        setReservationToDelete={setReservationToDelete}
        setDeleteDialogOpen={setDeleteDialogOpen}
        setBlockToDelete={setBlockToDelete}
        setBlockDeleteDialogOpen={setBlockDeleteDialogOpen}
        setChangeUnitReservation={setChangeUnitReservation}
        setChangeUnitDialogOpen={setChangeUnitDialogOpen}
        setHeaderExpanded={setHeaderExpanded}
      />


      {/* Guest Selection Dialog */}
      <CreateReservationDialog
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        pendingReservation={pendingReservation}
        guests={guests || []}
        units={units || []}
        createGuest={createGuest}
        newGuestCreated={newGuestCreated}
        onSelectGuest={(guestId, unitIds, notesValue, checkIn, checkOut) => {
          handleCreateReservation(guestId, unitIds, notesValue, checkIn, checkOut)
        }}
        onCancel={() => {
          setGuestDialogOpen(false)
          setPendingReservation(null)
          setNewGuestCreated(null)
        }}
        onGuestCreated={handleGuestCreated}
      />

      {/* Confirm Drag/Resize Change Dialog */}
      <ConfirmChangeDialog
        pendingChange={pendingEventChange}
        onConfirm={confirmEventChange}
        onCancel={cancelEventChange}
      />

      {/* Change Unit Dialog */}
      <ChangeUnitDialog
        open={changeUnitDialogOpen}
        reservation={changeUnitReservation}
        units={units}
        filteredUnitIds={filteredUnitIds}
        changingUnit={changingUnit}
        search={changeUnitSearch}
        onSearchChange={setChangeUnitSearch}
        onClose={() => { setChangeUnitDialogOpen(false); setChangeUnitReservation(null); setChangeUnitSearch('') }}
        onChangeUnit={handleChangeUnit}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteReservationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        reservation={reservationToDelete}
        onDelete={handleDeleteReservation}
        isPending={deleteReservation.isPending}
      />

      {/* Room Block Detail & Delete Dialog */}
      <RoomBlockDialog
        open={blockDeleteDialogOpen}
        onOpenChange={setBlockDeleteDialogOpen}
        block={blockToDelete}
        onDelete={() => { if (blockToDelete?.id) deleteRoomBlock.mutate(blockToDelete.id) }}
        isPending={deleteRoomBlock.isPending}
      />
    </div>
  )
}

