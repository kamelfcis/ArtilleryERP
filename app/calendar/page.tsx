'use client'

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import type FullCalendar from '@fullcalendar/react'
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
import { isRocketScopedUser } from '@/lib/constants/rocket-hotel'
import {
  getRocketManagedLocationIdsFromEnv,
  isRocketManagedLocation,
} from '@/lib/constants/rocket-locations'
import { useReservationsRealtime } from '@/lib/hooks/use-realtime'
import { useGuests, useCreateGuest } from '@/lib/hooks/use-guests'
import type { Guest } from '@/lib/types/database'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { useCreateBookingNotification } from '@/lib/hooks/use-booking-notifications'
import { ArrowLeftRight } from 'lucide-react'
import { useQueryClient, useQuery, useMutation, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiDelete, apiPost } from '@/lib/api/http-client'
import { fetchAdminUsers } from '@/lib/api/admin-users'
import { formatCurrency } from '@/lib/utils'
import { useCalendarFilters } from '@/contexts/CalendarFilterContext'
import '@/app/calendar/calendar-styles.css'
import { CalendarFilterSheet } from '@/components/calendar/CalendarFilterSheet'
import FullCalendarWidget from '@/components/calendar/FullCalendarWidget'
import { getStatusColor } from '@/lib/utils/calendar-helpers'
import { isUnconfirmedReservationAlarm } from '@/lib/utils/reservation-alerts'
import {
  getRoomBlockConflicts,
  getRoomBlockConflictsForUnits,
  type CalendarRoomBlock,
} from '@/lib/utils/room-block-overlap'
import {
  findConflictingReservations,
  formatReservationConflictMessage,
} from '@/lib/utils/reservation-overlap'

const CreateReservationDialog = dynamic(
  () => import('@/components/calendar/dialogs/CreateReservationDialog').then(m => ({ default: m.CreateReservationDialog })),
  { ssr: false }
)
const ConfirmChangeDialog = dynamic(
  () => import('@/components/calendar/dialogs/ConfirmChangeDialog').then(m => ({ default: m.ConfirmChangeDialog })),
  { ssr: false }
)
const ChangeUnitDialog = dynamic(
  () => import('@/components/calendar/dialogs/ChangeUnitDialog').then(m => ({ default: m.ChangeUnitDialog })),
  { ssr: false }
)
const DeleteReservationDialog = dynamic(
  () => import('@/components/calendar/dialogs/DeleteReservationDialog').then(m => ({ default: m.DeleteReservationDialog })),
  { ssr: false }
)
const RoomBlockDialog = dynamic(
  () => import('@/components/calendar/dialogs/RoomBlockDialog').then(m => ({ default: m.RoomBlockDialog })),
  { ssr: false }
)
const OverrideRoomBlockDialog = dynamic(
  () =>
    import('@/components/calendar/dialogs/OverrideRoomBlockDialog').then(m => ({
      default: m.OverrideRoomBlockDialog,
    })),
  { ssr: false }
)

type PendingBlockOverride =
  | {
      kind: 'create'
      guestId: string
      unitIds: string[]
      notes: string
      checkIn: string
      checkOut: string
      conflicts: CalendarRoomBlock[]
    }
  | { kind: 'drop'; conflicts: CalendarRoomBlock[] }
  | { kind: 'resize'; conflicts: CalendarRoomBlock[] }
  | { kind: 'changeUnit'; newUnitId: string; conflicts: CalendarRoomBlock[] }

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loadTooltipData, setLoadTooltipData] = useState(false)
  const {
    selectedLocation,
    setSelectedLocation,
    selectedTypes,
    setSelectedTypes,
  } = useCalendarFilters()
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
  const shiftRange = useCallback((days: number) => {
    const start = new Date(rangeStart)
    const end = new Date(rangeEnd)
    start.setDate(start.getDate() + days)
    end.setDate(end.getDate() + days)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setRangeStart(fmt(start))
    setRangeEnd(fmt(end))

    requestAnimationFrame(() => {
      const api = calendarRef.current?.getApi()
      if (api) {
        api.gotoDate(start)
      }
    })
  }, [rangeStart, rangeEnd])


  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [currentView, setCurrentView] = useState<'timeline' | 'day' | 'week' | 'month' | 'resourceTimeline'>('resourceTimeline')
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reservationToDelete, setReservationToDelete] = useState<CalendarEventRow | null>(null)
  const [blockDeleteDialogOpen, setBlockDeleteDialogOpen] = useState(false)
  const [blockToDelete, setBlockToDelete] = useState<any>(null)
  const [blockOverrideOpen, setBlockOverrideOpen] = useState(false)
  const [pendingBlockOverride, setPendingBlockOverride] = useState<PendingBlockOverride | null>(null)
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
  const isViewerMode = hasRole('Viewer')
  const { data: currentStaff, isLoading: currentStaffLoading } = useCurrentStaff({
    enabled: !isViewerMode,
  })
  const { data: allStaff } = useStaffList(undefined, { enabled: loadTooltipData })
  const isRocketScoped = isRocketScopedUser(user?.email)
  const isStaffOnly = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager') && !isViewerMode

  useEffect(() => {
    const schedule = () => setLoadTooltipData(true)
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(schedule, { timeout: 2500 })
      return () => cancelIdleCallback(id)
    }
    const timer = setTimeout(schedule, 1500)
    return () => clearTimeout(timer)
  }, [])
  
  const { data: authUsersForCreator } = useQuery({
    queryKey: ['auth-users-for-calendar'],
    queryFn: async () => {
      try {
        // Uses the Express backend (`/admin/users`) in api mode and the
        // Supabase-backed Next route otherwise; both return {id, email}.
        return (await fetchAdminUsers()) as Array<{ id: string; email?: string }>
      } catch {
        return []
      }
    },
    enabled: loadTooltipData,
    staleTime: 300_000,
    retry: false,
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

  const rocketManagedLocationIds = useMemo(() => {
    if (!isRocketScoped || !locations) return null as string[] | null
    const rocketIds = getRocketManagedLocationIdsFromEnv()
    if (rocketIds) return rocketIds.filter((id) => locations.some((l) => l.id === id))
    return locations.filter(isRocketManagedLocation).map((l) => l.id)
  }, [isRocketScoped, locations])

  const displayedLocations = useMemo(() => {
    if (!locations) return locations
    if (!isRocketScoped || !rocketManagedLocationIds?.length) return locations
    return locations.filter((l) => rocketManagedLocationIds.includes(l.id))
  }, [locations, isRocketScoped, rocketManagedLocationIds])

  // Fetch all units for the location (no type filter) to derive available unit types for the dropdown.
  // onlyCalendarFields trims the select to slim columns — no nested images/facilities/location objects.
  const { data: allLocationUnits, isLoading: unitsLoading } = useUnits({
    locationId: effectiveLocationId,
    onlyCalendarFields: true,
  })
  
  // Filter units client-side by selected types (O(n) with Set lookup)
  const selectedTypesSet = useMemo(() => new Set(selectedTypes), [selectedTypes])

  const units = useMemo(() => {
    if (!allLocationUnits) return undefined
    let list = allLocationUnits
    if (isRocketScoped && rocketManagedLocationIds?.length) {
      list = list.filter((u) => rocketManagedLocationIds.includes(u.location_id))
    }
    if (selectedTypesSet.size === 0) return list
    return list.filter(u => selectedTypesSet.has(u.type))
  }, [allLocationUnits, selectedTypesSet, isRocketScoped, rocketManagedLocationIds])

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

  const canUpdateUnitStatuses =
    !isViewerMode && (hasRole('SuperAdmin') || hasRole('Receptionist'))

  // Prefetch adjacent windows after the first load, during idle time.
  useEffect(() => {
    if (!rangeStart || !rangeEnd) return
    if (!navigator.onLine) return
    if (reservationsLoading && reservations === undefined) return

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

    const runPrefetch = () => {
      const prev = shift(-1)
      const next = shift(+1)
      queryClient.prefetchQuery({
        queryKey: calendarWindowKey(prev),
        queryFn: () => fetchCalendarWindow(prev),
        staleTime: 60_000,
      })
      queryClient.prefetchQuery({
        queryKey: calendarWindowKey(next),
        queryFn: () => fetchCalendarWindow(next),
        staleTime: 60_000,
      })
    }

    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(runPrefetch, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }

    const timer = setTimeout(runPrefetch, 500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd, effectiveLocationId, selectedStatus, reservationsLoading, reservations])
  const { data: guests } = useGuests(undefined, { enabled: guestDialogOpen })
  const createReservation = useCreateReservation()
  const createBookingNotif = useCreateBookingNotification()
  const createGuest = useCreateGuest()
  const updateReservation = useUpdateReservation()
  const deleteReservation = useDeleteReservation()

  // ── Offline / PWA ─────────────────────────────────────────────────────────
  const isOnline = useIsOnline()
  const offlineMutation = useOfflineMutation(calendarArgs)
  // Mount the sync engine — drains outbox and delta-pulls on reconnect.
  useSyncEngine(calendarArgs, { enabled: !isViewerMode })
  const [conflictSheetOpen, setConflictSheetOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  // Set of outbox localIds — used to show pending badges on calendar events.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isViewerMode) return

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
  }, [isViewerMode])

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
      if (isApiProvider()) {
        await apiDelete(`/room-blocks/${id}`)
        return
      }
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
  const { data: roomBlocks } = useQuery({
    queryKey: ['room-blocks', rangeStart, rangeEnd],
    enabled: reservations !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      if (isApiProvider()) {
        return apiGet<any[]>('/room-blocks')
      }

      const { data, error } = await supabase
        .from('room_blocks')
        .select(`
          id,
          name,
          name_ar,
          reason,
          reason_ar,
          start_date,
          end_date,
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
    
    return sorted.map(unit => ({
      id: unit.id,
      title: `${unit.unit_number} - ${unit.name_ar || unit.name || ''}`,
      orderno: (unit as any).orderno ?? 999999,
      extendedProps: {
        unit,
        type: unit.type,
      },
    }))
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
            // FullCalendar eventContent renders rich HTML; keep title minimal to avoid duplicate locale work.
            const eventTitle = guestName || unitNumber || reservation.id.substring(0, 8)
            const showAlarm = isUnconfirmedReservationAlarm(
              reservation.status,
              reservation.created_at,
              { locationId: reservation.location_id, locations: locations ?? [] }
            )

            return {
              id: reservation.id,
              title: eventTitle,
              start: reservation.check_in_date,
              end: reservation.check_out_date,
              resourceId: reservation.unit_id,
              backgroundColor: statusColor,
              borderColor: statusColor,
              classNames: [
                `status-${reservation.status}`,
                ...(showAlarm ? ['reservation-alarm'] : []),
              ],
              extendedProps: {
                reservation,
                status: reservation.status,
                statusColor,
                unitNumber,
                guestPhone,
                showAlarm,
              },
            }
          })
      }, [reservations, filteredUnitIds, locations])

      // Create events for room blocks with black color
      const roomBlockEvents = useMemo(() => {
        if (!roomBlocks) return []

        return roomBlocks.flatMap((block: any) => {
          const blockUnitIds = block.units?.map((u: any) => u.unit?.id).filter(Boolean) || []
          if (!blockUnitIds.some((unitId: string) => filteredUnitIds.has(unitId))) return []

          return blockUnitIds
            .filter((unitId: string) => filteredUnitIds.has(unitId))
            .map((unitId: string) => {
              const unit = block.units.find((u: any) => u.unit?.id === unitId)?.unit
              const blockLabel = block.name_ar || block.name || ''

              return {
                id: `block-${block.id}-${unitId}`,
                title: `🚫 ${blockLabel}`,
                start: block.start_date,
                end: block.end_date,
                resourceId: unitId,
                display: 'background' as const,
                editable: false,
                overlap: false,
                backgroundColor: '#000000',
                borderColor: '#000000',
                textColor: '#ffffff',
                classNames: ['room-block'],
                extendedProps: {
                  roomBlock: block,
                  unitId,
                  unitNumber: unit?.unit_number || '',
                },
              }
            })
        })
      }, [roomBlocks, filteredUnitIds])

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
        return [...roomBlockEvents, ...reservationEvents, ...maintenanceEvents]
      }, [reservationEvents, roomBlockEvents, maintenanceEvents])

  // Defer status sync so it does not compete with the initial calendar load.
  useEffect(() => {
    if (!canUpdateUnitStatuses) return

    const run = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      updateUnitStatuses({ silent: true })
    }
    const timer = setTimeout(run, 5000)
    const onOnline = () => run()
    window.addEventListener('online', onOnline)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', onOnline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUpdateUnitStatuses])

  // Function to update unit statuses
  async function updateUnitStatuses(options?: { silent?: boolean }) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!options?.silent) {
        toast({
          title: 'غير متصل',
          description: 'سيتم التحديث عند عودة الاتصال',
        })
      }
      return
    }
    try {
      setIsUpdatingStatuses(true)
      let result: { message?: string }
      if (isApiProvider()) {
        // Express backend runs the same `update_all_unit_statuses()` sync.
        // apiPost throws on non-2xx; the catch below honours `options.silent`.
        result = await apiPost<{ success: boolean; message?: string }>(
          '/admin/update-unit-statuses'
        )
      } else {
        const response = await fetch('/api/admin/update-unit-statuses', {
          method: 'POST',
        })

        if (!response.ok) {
          if (options?.silent || response.status === 503) {
            return
          }
          throw new Error('فشل في تحديث الحالات')
        }

        result = await response.json()
      }

      queryClient.invalidateQueries({ queryKey: ['units'] })
      
      if (!options?.silent) {
        toast({
          title: 'نجح',
          description: result.message || 'تم تحديث حالات الوحدات بنجاح',
        })
      }
    } catch (error: unknown) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : 'فشل في تحديث حالات الوحدات'
        toast({
          title: 'خطأ',
          description: message,
          variant: 'destructive',
        })
      }
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

  // Navbar / filter sheet week jumps (±7 days)
  useEffect(() => {
    const handleNavShift = (e: Event) => {
      const days = (e as CustomEvent<{ days: number }>).detail?.days
      if (typeof days === 'number' && days !== 0) shiftRange(days)
    }
    window.addEventListener('calendar:nav-shift', handleNavShift)
    return () => window.removeEventListener('calendar:nav-shift', handleNavShift)
  }, [shiftRange])

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
  }, [shiftRange])


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

    const uniqueUnitIds = Array.from(new Set(unitIds))
    const conflicts = getRoomBlockConflictsForUnits(
      uniqueUnitIds,
      checkIn,
      checkOut,
      roomBlocks as CalendarRoomBlock[] | undefined
    )
    if (conflicts.length > 0) {
      setPendingBlockOverride({
        kind: 'create',
        guestId,
        unitIds: uniqueUnitIds,
        notes,
        checkIn,
        checkOut,
        conflicts,
      })
      setBlockOverrideOpen(true)
      return
    }

    await executeCreateReservation(guestId, uniqueUnitIds, notes, checkIn, checkOut)
  }

  async function executeCreateReservation(
    guestId: string,
    unitIds: string[],
    notes: string,
    checkIn: string,
    checkOut: string
  ) {
    // Close selection dialog immediately — optimistic update will paint the calendar
    setGuestDialogOpen(false)
    setPendingReservation(null)

    // The guest may have been found via a search query in GuestSelectionDialog
    // (cached under ['guests', '<search>']) rather than the parent's base list
    // (['guests', ''], limited to 100). Scan all cached guest query results so
    // a guest located through search is always found.
    let selectedGuest: Guest | undefined = guests?.find(g => g.id === guestId)
    if (!selectedGuest) {
      const allGuestData = queryClient.getQueriesData<Guest[]>({ queryKey: ['guests'] })
      for (const [, data] of allGuestData) {
        if (Array.isArray(data)) {
          const found = data.find(g => g.id === guestId)
          if (found) { selectedGuest = found; break }
        }
      }
    }
    if (!selectedGuest) {
      toast({ title: 'خطأ', description: 'الضيف غير موجود', variant: 'destructive' })
      return
    }

    const { calculateReservationPrice } = await import('@/lib/utils/pricing')
    const unitMap = new Map((units || []).map(u => [u.id, u]))
    const uniqueUnitIds = unitIds
    const isOnline = typeof navigator === 'undefined' || navigator.onLine
    const isRestrictedBM =
      hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps

    // Run all per-unit creates in parallel so N units take ≈ time of the slowest one
    const results = await Promise.allSettled(
      uniqueUnitIds.map(async (unitId) => {
        const unit = unitMap.get(unitId)
        if (!unit) throw new Error(`الوحدة ${unitId} غير موجودة`)

        // Fetch pricing only when online; offline falls back to unit base price.
        // In api mode there is no supabase pricing access here, so fall back to
        // the unit base price (server can still recompute on create).
        let pricingData: any[] | null = null
        if (isOnline && !isApiProvider()) {
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

        if (isOnline) {
          const conflicting = await findConflictingReservations(unitId, checkIn, checkOut)
          if (conflicting.length > 0) {
            throw new Error(formatReservationConflictMessage(unit.unit_number))
          }
        }

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

      // Ensure the visible fetch window includes the new stay dates, then refresh cache.
      if (!offline) {
        let nextStart = rangeStart
        let nextEnd = rangeEnd
        if (checkIn < nextStart) {
          nextStart = checkIn
          setRangeStart(checkIn)
        }
        if (checkOut > nextEnd) {
          nextEnd = checkOut
          setRangeEnd(checkOut)
        }
        // New calendar bookings are always pending — widen status filter if it would hide them.
        let statusFilter = calendarArgs.status
        if (selectedStatus !== 'all' && selectedStatus !== 'pending') {
          setSelectedStatus('all')
          statusFilter = undefined
        }
        const refreshedArgs: CalendarWindowArgs = {
          ...calendarArgs,
          start: nextStart,
          end: nextEnd,
          status: statusFilter,
        }
        try {
          const fresh = await fetchCalendarWindow(refreshedArgs)
          queryClient.setQueryData(calendarWindowKey(refreshedArgs), fresh)
        } catch {
          queryClient.invalidateQueries({ queryKey: ['calendar-window'] })
        }
      }
    }

    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    )
    if (failures.length > 0) {
      const firstMessage =
        failures[0]?.reason instanceof Error
          ? failures[0].reason.message
          : typeof failures[0]?.reason === 'string'
            ? failures[0].reason
            : null
      toast({
        title: 'تحذير',
        description:
          firstMessage ||
          `فشل إنشاء ${failures.length} حجز. يرجى المحاولة مجدداً.`,
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

  async function applyDropEventChange() {
    if (!pendingEventChange || pendingEventChange.type !== 'drop') return
    const { info, reservationId, newStartDate, newEndDate, newUnitId } = pendingEventChange
    const reservation = info.event.extendedProps.reservation as CalendarEventRow
    const unitChanged = newUnitId && newUnitId !== reservation.unit_id

    try {
      if (unitChanged && newUnitId && !isApiProvider()) {
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
      }

      if (!isOnline) {
        await offlineMutation.update({
          id: reservationId,
          check_in_date: newStartDate,
          check_out_date: newEndDate,
          ...(unitChanged ? { unit_id: newUnitId } : {}),
        })
        const newUnit = unitChanged ? units?.find(u => u.id === newUnitId) : null
        toast({
          title: 'محفوظ للمزامنة',
          description: unitChanged
            ? `سيُنقل الحجز إلى ${newUnit?.unit_number || newUnitId} عند الاتصال`
            : 'سيُحدَّث الحجز عند الاتصال.',
        })
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

    setPendingEventChange(null)
  }

  async function applyResizeEventChange() {
    if (!pendingEventChange || pendingEventChange.type !== 'resize') return
    const { info, reservationId, newStartDate, newEndDate } = pendingEventChange

    try {
      if (!isOnline) {
        await offlineMutation.update({
          id: reservationId,
          check_in_date: newStartDate,
          check_out_date: newEndDate,
        })
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

    setPendingEventChange(null)
  }

  async function confirmEventChange() {
    if (!pendingEventChange) return
    const { type, info, newStartDate, newEndDate, newUnitId } = pendingEventChange

    if (type === 'drop') {
      const reservation = info.event.extendedProps.reservation as CalendarEventRow
      const targetUnitId = newUnitId || reservation.unit_id
      const conflicts = getRoomBlockConflicts(
        targetUnitId,
        newStartDate!,
        newEndDate!,
        roomBlocks as CalendarRoomBlock[] | undefined
      )
      if (conflicts.length > 0) {
        setPendingBlockOverride({ kind: 'drop', conflicts })
        setBlockOverrideOpen(true)
        return
      }
      await applyDropEventChange()
    } else if (type === 'resize') {
      const reservation = info.event.extendedProps.reservation as CalendarEventRow
      const conflicts = getRoomBlockConflicts(
        reservation.unit_id,
        newStartDate!,
        newEndDate!,
        roomBlocks as CalendarRoomBlock[] | undefined
      )
      if (conflicts.length > 0) {
        setPendingBlockOverride({ kind: 'resize', conflicts })
        setBlockOverrideOpen(true)
        return
      }
      await applyResizeEventChange()
    }
  }

  async function handleBlockOverrideConfirm() {
    const override = pendingBlockOverride
    if (!override) return
    setBlockOverrideOpen(false)
    setPendingBlockOverride(null)

    if (override.kind === 'create') {
      await executeCreateReservation(
        override.guestId,
        override.unitIds,
        override.notes,
        override.checkIn,
        override.checkOut
      )
      return
    }

    if (override.kind === 'changeUnit') {
      await executeChangeUnit(override.newUnitId)
      return
    }

    if (override.kind === 'drop') {
      await applyDropEventChange()
      return
    }

    if (override.kind === 'resize') {
      await applyResizeEventChange()
    }
  }

  function handleBlockOverrideCancel() {
    const override = pendingBlockOverride
    setBlockOverrideOpen(false)
    setPendingBlockOverride(null)

    if (override?.kind === 'drop' || override?.kind === 'resize') {
      cancelEventChange()
    }
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
      if (newUnit?.status === 'maintenance') {
        toast({
          title: 'خطأ',
          description: `الوحدة ${newUnit.unit_number} قيد الصيانة ولا يمكن نقل الحجز إليها.`,
          variant: 'destructive',
        })
        return
      }

      const conflicts = getRoomBlockConflicts(
        newUnitId,
        res.check_in_date,
        res.check_out_date,
        roomBlocks as CalendarRoomBlock[] | undefined
      )
      if (conflicts.length > 0) {
        setPendingBlockOverride({ kind: 'changeUnit', newUnitId, conflicts })
        setBlockOverrideOpen(true)
        return
      }

      await executeChangeUnit(newUnitId)
    } finally {
      setChangingUnit(false)
    }
  }

  async function executeChangeUnit(newUnitId: string) {
    if (!changeUnitReservation) return
    const res = changeUnitReservation
    const newUnit = units?.find(u => u.id === newUnitId)

    try {
      if (!isApiProvider()) {
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
      }

      await updateReservation.mutateAsync({
        id: res.id,
        unit_id: newUnitId,
      })

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
    }
  }

  const staffProfileLoading =
    isStaffOnly && Boolean(user?.id) && currentStaffLoading

  // Progressive load: show calendar once core data exists; room blocks load in background.
  const calendarDataLoading =
    staffProfileLoading ||
    (unitsLoading && allLocationUnits === undefined) ||
    (reservationsLoading && reservations === undefined)

  const calendarDataReady = !calendarDataLoading

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20">
      {/* Offline banner — appears when offline or when pending outbox entries exist */}
      <div className="shrink-0">
        {!isViewerMode && (
          <OfflineBanner onSyncRequest={handleManualSync} syncing={isSyncing} />
        )}
      </div>
      {/* Conflict resolution sheet — opens automatically when sync conflicts are detected */}
      {!isViewerMode && (
      <ConflictResolutionSheet
        open={conflictSheetOpen}
        onOpenChange={setConflictSheetOpen}
      />
      )}

      {calendarDataReady && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
        locations={displayedLocations}
        units={units}
        availableUnitTypes={availableUnitTypes}
        isStaffOnly={isStaffOnly}
        isViewerMode={isViewerMode}
        currentStaff={currentStaff}
        isUpdatingStatuses={isUpdatingStatuses}
        updateUnitStatuses={updateUnitStatuses}
        currentView={currentView}
        setCurrentView={setCurrentView}
        calendarRef={calendarRef}
      />

      {/* Full Calendar Widget — sole flex child that grows */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
        readOnly={isViewerMode}
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
      />
      </div>

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

      <OverrideRoomBlockDialog
        open={blockOverrideOpen}
        onOpenChange={setBlockOverrideOpen}
        conflicts={pendingBlockOverride?.conflicts ?? []}
        onConfirm={handleBlockOverrideConfirm}
        onCancel={handleBlockOverrideCancel}
      />
        </div>
      )}
    </div>
  )
}

