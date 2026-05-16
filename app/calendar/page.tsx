'use client'

import React, { useRef, useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
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
import { GuestForm } from '@/components/forms/GuestForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Reservation } from '@/lib/types/database'
import { CalendarViewSwitcher } from '@/components/calendar/CalendarViewSwitcher'
import arLocale from '@fullcalendar/core/locales/ar'
import { RESERVATION_STATUSES } from '@/lib/constants'
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

const SHAKKA_3_ROOM_GRADIENT =
  'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
const SHAKKA_2_ROOM_GRADIENT =
  'linear-gradient(135deg, #f472b6 0%, #db2777 100%)'

/** Distinct calendar resource icon backgrounds for "شقة 3 غرف" vs "شقة 2 غرف" (and beds fallback). */
function getShakkaRoomIconGradient(unit: {
  type?: string
  name?: string
  name_ar?: string
  beds?: number
} | null | undefined): string | null {
  if (!unit) return null
  const text = `${unit.name_ar || ''} ${unit.name || ''}`
  const isApartment =
    unit.type === 'apartment' || /شقة/.test(text)
  if (!isApartment) return null

  const bundle = text.toLowerCase()
  const has3 =
    /(^|[^\d])3\s*غرف/.test(bundle) ||
    /٣\s*غرف/.test(text) ||
    /ثلاث\s*غرف/.test(bundle) ||
    /3\s*bedroom/.test(bundle)
  const has2 =
    /(^|[^\d])2\s*غرف/.test(bundle) ||
    /٢\s*غرف/.test(text) ||
    /غرفتين/.test(bundle) ||
    /2\s*bedroom/.test(bundle)

  if (has3 && !has2) return SHAKKA_3_ROOM_GRADIENT
  if (has2 && !has3) return SHAKKA_2_ROOM_GRADIENT
  if (has3 && has2) {
    const pos3Candidates = [
      bundle.search(/3\s*غرف/),
      bundle.search(/ثلاث\s*غرف/),
      text.search(/٣\s*غرف/),
    ].filter((i) => i >= 0)
    const pos2Candidates = [
      bundle.search(/2\s*غرف/),
      bundle.search(/غرفتين/),
      text.search(/٢\s*غرف/),
    ].filter((i) => i >= 0)
    const pos3 = pos3Candidates.length ? Math.min(...pos3Candidates) : -1
    const pos2 = pos2Candidates.length ? Math.min(...pos2Candidates) : -1
    if (pos3 >= 0 && (pos2 < 0 || pos3 < pos2)) return SHAKKA_3_ROOM_GRADIENT
    if (pos2 >= 0) return SHAKKA_2_ROOM_GRADIENT
  }

  const beds = unit.beds
  if (beds === 3) return SHAKKA_3_ROOM_GRADIENT
  if (beds === 2) return SHAKKA_2_ROOM_GRADIENT
  return null
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null)
  const calendarContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef(0)
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
  const calendarArgs: CalendarWindowArgs = {
    locationId: effectiveLocationId,
    start: rangeStart,
    end: rangeEnd,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
  }
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
  const { data: guests, isLoading: guestsLoading } = useGuests()
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
    const refresh = async () => {
      if (!mounted) return
      try {
        const entries = await db.outbox.toArray()
        if (mounted) setPendingIds(new Set(entries.map(e => e.localId)))
        // Surface conflict sheet automatically when conflicts exist.
        const hasConflicts = entries.some(e => e.conflict)
        if (hasConflicts && mounted) setConflictSheetOpen(true)
      } catch { /* IDB not available in SSR */ }
    }
    refresh()
    const id = setInterval(refresh, 4000)
    return () => { mounted = false; clearInterval(id) }
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

  // Helper functions - defined before useMemo
  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: '#fbbf24',
      confirmed: '#10b981',
      checked_in: '#3b82f6',
      checked_out: '#6b7280',
      cancelled: '#ef4444',
      no_show: '#9ca3af',
    }
    return colors[status] || '#6b7280'
  }

  function getStatusGradient(status: string): string {
    const gradients: Record<string, string> = {
      pending: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      confirmed: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      checked_in: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      checked_out: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
      cancelled: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      no_show: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
    }
    return gradients[status] || gradients.checked_out
  }

  // Icons for unit types
  const getUnitTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      room: Home,
      suite: Hotel,
      chalet: Mountain,
      duplex: Layers,
      villa: Building,
    }
    return icons[type] || Building2
  }

  // Premium icons and colors for unit types using Lucide React icons
  const getUnitTypeIconData = (type: string): { path: string; color: string; gradient: string } => {
    const iconData: Record<string, { path: string; color: string; gradient: string }> = {
      room: {
        // Bed icon - perfect for rooms
        path: '<path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>',
        color: '#3b82f6', // Blue
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      },
      suite: {
        // Crown icon - luxury suites
        path: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L16 7l4-1l-1.5 6H5.5L4 6l4 1z"></path><path d="M5.5 12H18.5"></path><path d="M6 12v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3"></path>',
        color: '#ef4444', // Red
        gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      },
      chalet: {
        // Cabin/Trees icon - nature chalets
        path: '<path d="M19 21h-8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2z"></path><path d="M7 8l4-4 4 4"></path><path d="M3 21h18"></path><path d="M7 21v-8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8"></path>',
        color: '#10b981', // Green
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      },
      duplex: {
        // Layers/Split icon - two levels
        path: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"></path><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"></path><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"></path>',
        color: '#f59e0b', // Amber
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      },
      villa: {
        // Castle icon - luxury villas
        path: '<path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"></path><path d="M18 11V9a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M14 10V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"></path><path d="M10 6h4"></path><path d="M6 6h4"></path><path d="M6 10h4"></path><path d="M6 14h4"></path><path d="M10 14h4"></path><path d="M16 14h4"></path><path d="M18 18v3"></path><path d="M4 18v3"></path>',
        color: '#ef4444', // Red
        gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      },
    }
    return iconData[type] || {
      path: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
      color: '#6b7280',
      gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    }
  }

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

  // Scroll to today (or restore saved position) when calendar mounts
  useEffect(() => {
    const scrollToToday = () => {
      if (!calendarRef.current) return
      const calendarApi = calendarRef.current.getApi()
      const today = new Date()
      
      setTimeout(() => {
        const container = calendarContainerRef.current
        if (!container) return

        const scrollers = container.querySelectorAll('.fc-scroller-liquid-absolute, .fc-scroller')

        // Restore saved scroll position if returning from a reservation detail page
        const savedScroll = sessionStorage.getItem('calendar-scroll-left')
        if (savedScroll !== null) {
          sessionStorage.removeItem('calendar-scroll-left')
          const scrollLeft = parseFloat(savedScroll)
          scrollers.forEach(el => {
            const scroller = el as HTMLElement
            if (scroller.scrollWidth > scroller.clientWidth) {
              scroller.scrollLeft = scrollLeft
            }
          })
          return
        }

        // Otherwise scroll to today's position
        const viewStart = new Date(rangeStart)
        const viewEnd = new Date(rangeEnd)
        const totalDays = Math.round((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24))
        if (totalDays <= 0) return

        const dayOffset = Math.round((today.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24))
        const fraction = Math.max(0, Math.min(1, dayOffset / totalDays))

        scrollers.forEach(el => {
          const scroller = el as HTMLElement
          if (scroller.scrollWidth <= scroller.clientWidth) return
          const target = fraction * scroller.scrollWidth - scroller.clientWidth * 0.25
          scroller.scrollLeft = Math.max(0, target)
        })
      }, 400)
    }
    
    // Delay to ensure calendar is fully rendered
    const timer = setTimeout(scrollToToday, 200)
    return () => clearTimeout(timer)
  }, [resources.length, rangeStart, rangeEnd]) // Re-run when resources or range change

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

  // Auto-collapse header on scroll down, expand on scroll up
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const handleScroll = () => {
      const currentScrollTop = el.scrollTop
      const delta = currentScrollTop - lastScrollTopRef.current

      if (delta > 30) {
        // Scrolling down — collapse
        setHeaderExpanded(false)
        lastScrollTopRef.current = currentScrollTop
      } else if (delta < -30) {
        // Scrolling up — expand
        setHeaderExpanded(true)
        lastScrollTopRef.current = currentScrollTop
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const saveScrollPosition = () => {
    const container = calendarContainerRef.current
    if (!container) return
    const scroller = container.querySelector('.fc-scroller-liquid-absolute, .fc-scroller')
    if (scroller) {
      sessionStorage.setItem('calendar-scroll-left', String((scroller as HTMLElement).scrollLeft))
    }
  }

  function handleEventClick(clickInfo: any) {
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
      saveScrollPosition()
      router.push(`/reservations/${reservation.id}`)
    }
  }

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

  async function handleDateSelect(selectInfo: any) {
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
  }

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

  function handleEventDrop(dropInfo: any) {
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
  }

  function handleEventResize(resizeInfo: any) {
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
  }

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
    locationsLoading ||
    guestsLoading ||
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
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        {/* FAB - Floating Action Button */}
        <SheetTrigger asChild>
          <motion.div
            className="fixed bottom-6 right-6 z-50 no-print"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Button
                className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all border-2 border-white/20 backdrop-blur-md relative overflow-hidden group"
                size="icon"
                title="فتح الفلاتر"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Filter className="h-6 w-6 relative z-10" />
                {/* Active filters indicator dot */}
                {(selectedLocation !== 'all' || selectedTypes.length > 0 || selectedUnit !== 'all' || selectedStatus !== 'all') && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg z-20" />
                )}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-indigo-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
              </Button>
            </motion.div>
          </motion.div>
        </SheetTrigger>

        <SheetContent side="right" className="w-[380px] sm:max-w-md overflow-y-auto bg-gradient-to-br from-white via-blue-50/50 to-purple-50/50 dark:from-slate-900 dark:via-blue-950/30 dark:to-purple-950/30">
          <SheetHeader className="pb-4 border-b border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  فلاتر الحجز السريع
                </SheetTitle>
                <SheetDescription className="text-xs">
                  تصفية وإدارة عرض التقويم
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-5 py-5">
            {/* Location Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                الموقع
              </Label>
              {!isStaffOnly ? (
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-full h-10 bg-white/80 dark:bg-slate-800/80 border-2 border-blue-200/50 dark:border-blue-800/50 shadow-md hover:shadow-lg transition-all hover:border-blue-400 dark:hover:border-blue-600">
                    <SelectValue placeholder="الموقع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المواقع</SelectItem>
                    {locations?.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="px-3 py-2 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md border-2 border-blue-300 dark:border-blue-700 flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-4 w-4" />
                  {currentStaff?.location?.name_ar || currentStaff?.location?.name || 'موقعي'}
                </div>
              )}
            </div>

            {/* Unit Type Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-500" />
                نوع الوحدة
              </Label>
              <div className="space-y-1 p-2 rounded-lg border-2 border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-slate-800/80">
                <button
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${selectedTypes.length === 0 ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  onClick={() => setSelectedTypes([])}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedTypes.length === 0 ? 'bg-purple-500 border-purple-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {selectedTypes.length === 0 && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span>جميع الأنواع</span>
                </button>
                {([
                  { value: 'room', label: 'غرفة', icon: Bed, color: 'text-blue-500' },
                  { value: 'suite', label: 'سويت', icon: Crown, color: 'text-red-500' },
                  { value: 'chalet', label: 'شاليه', icon: Trees, color: 'text-green-500' },
                  { value: 'duplex', label: 'دوبلكس', icon: Layers, color: 'text-amber-500' },
                  { value: 'villa', label: 'فيلا', icon: Castle, color: 'text-red-500' },
                  { value: 'apartment', label: 'شقة', icon: Building2, color: 'text-cyan-500' },
                ] as const).filter(t => availableUnitTypes.includes(t.value)).map(typeOption => {
                  const isSelected = selectedTypes.includes(typeOption.value)
                  const IconComp = typeOption.icon
                  return (
                    <button
                      key={typeOption.value}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${isSelected ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      onClick={() => {
                        setSelectedTypes(prev =>
                          isSelected
                            ? prev.filter(t => t !== typeOption.value)
                            : [...prev, typeOption.value]
                        )
                      }}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-300 dark:border-slate-600'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <IconComp className={`w-4 h-4 ${typeOption.color}`} />
                      <span>{typeOption.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Unit Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Home className="w-4 h-4 text-cyan-500" />
                الوحدة
              </Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-full h-10 bg-white/80 dark:bg-slate-800/80 border-2 border-cyan-200/50 dark:border-cyan-800/50 shadow-md hover:shadow-lg transition-all hover:border-cyan-400 dark:hover:border-cyan-600">
                  <SelectValue placeholder="الوحدة">
                    {selectedUnit !== 'all' ? (
                      <span className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-cyan-500" />
                        <span className="text-sm font-semibold">
                          {units?.find(u => u.id === selectedUnit)?.unit_number} - {units?.find(u => u.id === selectedUnit)?.name_ar || units?.find(u => u.id === selectedUnit)?.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm">جميع الوحدات</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <span>جميع الوحدات</span>
                    </div>
                  </SelectItem>
                  {units?.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {unit.unit_number}
                        </div>
                        <span className="font-medium">{unit.name_ar || unit.name}</span>
                        <span className="text-xs text-muted-foreground">({unit.type})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                حالة الحجز
              </Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full h-10 bg-white/80 dark:bg-slate-800/80 border-2 border-emerald-200/50 dark:border-emerald-800/50 shadow-md hover:shadow-lg transition-all hover:border-emerald-400 dark:hover:border-emerald-600">
                  <SelectValue placeholder="الحالة">
                    {selectedStatus !== 'all' ? (
                      <span className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full shadow-sm border border-white/70 inline-block"
                          style={{ backgroundColor: getStatusColor(selectedStatus) }}
                        />
                        <span className="text-sm font-semibold">{RESERVATION_STATUSES[selectedStatus as keyof typeof RESERVATION_STATUSES]}</span>
                      </span>
                    ) : (
                      <span className="text-sm">جميع الحالات</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-slate-400 to-slate-500 shadow-sm border border-white/70" />
                      <span className="text-sm font-semibold">جميع الحالات</span>
                    </div>
                  </SelectItem>
                  {Object.entries(RESERVATION_STATUSES).map(([status, label]) => {
                    const statusColor = getStatusColor(status)
                    return (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full shadow-sm border border-white/70"
                            style={{ backgroundColor: statusColor }}
                          />
                          <span className="text-sm font-semibold">{label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-green-500" />
                نطاق التاريخ
              </Label>
              <div className="space-y-3 p-3 rounded-lg border-2 border-green-200/50 dark:border-green-800/50 bg-white/80 dark:bg-slate-800/80">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => shiftRange(-1)}
                    className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 dark:from-blue-900/40 dark:to-indigo-900/40 dark:hover:from-blue-800/60 dark:hover:to-indigo-800/60 text-blue-700 dark:text-blue-400 shadow-sm"
                    title="اليوم السابق"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-bold text-slate-500 flex-1 text-center">التنقل يوم</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => shiftRange(1)}
                    className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 dark:from-blue-900/40 dark:to-indigo-900/40 dark:hover:from-blue-800/60 dark:hover:to-indigo-800/60 text-blue-700 dark:text-blue-400 shadow-sm"
                    title="اليوم التالي"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold text-green-700 dark:text-green-400 whitespace-nowrap w-8">من</Label>
                  <Input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="h-10 flex-1 bg-white/80 dark:bg-slate-800/80 border-2 border-green-200/50 dark:border-green-800/50 shadow-sm hover:shadow-md transition-all hover:border-green-400 dark:hover:border-green-600 text-sm font-medium"
                  />
                  {rangeStart !== getTodayString() && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setRangeStart(getTodayString())
                        localStorage.removeItem('calendar-range-start')
                      }}
                      className="h-8 w-8 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-800/60 text-green-700 dark:text-green-400 shadow-sm flex-shrink-0"
                      title="إعادة تعيين إلى اليوم"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold text-orange-700 dark:text-orange-400 whitespace-nowrap w-8">إلى</Label>
                  <Input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="h-10 flex-1 bg-white/80 dark:bg-slate-800/80 border-2 border-orange-200/50 dark:border-orange-800/50 shadow-sm hover:shadow-md transition-all hover:border-orange-400 dark:hover:border-orange-600 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Actions: Refresh + View Switcher */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-500" />
                الإجراءات والعرض
              </Label>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={updateUnitStatuses}
                  disabled={isUpdatingStatuses}
                  className="h-10 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all border-0 text-sm"
                >
                  <RefreshCw 
                    className={`mr-2 h-4 w-4 ${isUpdatingStatuses ? 'animate-spin' : ''}`} 
                  />
                  {isUpdatingStatuses ? 'جاري التحديث...' : 'تحديث'}
                </Button>
                <CalendarViewSwitcher
                  currentView={currentView}
                  onViewChange={(view) => {
                    setCurrentView(view)
                    if (calendarRef.current) {
                      const calendarApi = calendarRef.current.getApi()
                      if (view === 'resourceTimeline') {
                        calendarApi.changeView('resourceTimelineCustom')
                      } else if (view === 'day') {
                        calendarApi.changeView('timeGridDay')
                      } else if (view === 'week') {
                        calendarApi.changeView('timeGridWeek')
                      } else if (view === 'month') {
                        calendarApi.changeView('dayGridMonth')
                      } else {
                        calendarApi.changeView('resourceTimelineCustom')
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Status Legend */}
            <div className="space-y-2 pt-4 border-t border-blue-200/50 dark:border-blue-800/50">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg" />
                مفتاح الحالات
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(RESERVATION_STATUSES).map(([status, label]) => {
                  const statusColor = getStatusColor(status)
                  return (
                    <div
                      key={status}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                    >
                      <div
                        className="w-4 h-4 rounded-full shadow-sm border-2 border-white/70"
                        style={{ backgroundColor: statusColor }}
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Premium Full Screen Calendar with margins */}
      <motion.div
        ref={scrollContainerRef}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex-1 overflow-auto px-2 pb-2 min-h-0"
      >
        <div 
          ref={calendarContainerRef}
          className="h-full min-h-[600px] bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 shadow-xl overflow-hidden backdrop-blur-xl relative rounded-xl">
          <div className="p-2 relative z-10">
            <FullCalendar
              key={`calendar-${selectedLocation}-${selectedTypes.join(',')}-${selectedUnit}-${calendarDirection}`}
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, resourceTimelinePlugin]}
              initialView={currentView === 'resourceTimeline' ? 'resourceTimelineCustom' :
                         currentView === 'month' ? 'dayGridMonth' : 
                         currentView === 'day' ? 'timeGridDay' :
                         currentView === 'week' ? 'timeGridWeek' : 
                         'resourceTimelineCustom'}
              initialDate={new Date()}
              headerToolbar={false}
              nowIndicator={true}
              stickyHeaderDates={true}
              scrollTime="00:00:00"
              scrollTimeReset={false}
              direction={calendarDirection}
              locale={arLocale}
              resources={resources}
              events={events}
              editable={true}
              eventResourceEditable={true}
              selectable={true}
              selectMirror={true}
              selectAllow={(selectInfo) => {
                const ms = selectInfo.end.getTime() - selectInfo.start.getTime()
                const nights = Math.max(0, Math.round(ms / 86400000))
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('calendar:drag-nights', { detail: { nights } }))
                }
                return true
              }}
              unselect={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('calendar:drag-nights', { detail: { nights: 0 } }))
                }
              }}
              dayMaxEvents={true}
              resourceAreaWidth="240px"
              resourceAreaHeaderContent={
                <div className="text-center w-full font-bold text-3xl">الوحدة</div>
              }
              resourceOrder="orderno,title"
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              slotDuration="24:00:00"
              slotLabelInterval="24:00:00"
              slotLabelFormat={{
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              }}
              views={{
                resourceTimelineCustom: {
                  type: 'resourceTimeline',
                  visibleRange: {
                    start: rangeStart,
                    end: rangeEnd,
                  },
                  slotDuration: { days: 1 },
                  slotLabelInterval: { days: 1 },
                  scrollTime: '00:00:00',
                },
              }}
              slotMinWidth={80}
              slotLabelContent={(arg) => {
                const date = arg.date
                if (!date) return { html: '' }
                const dayName = date.toLocaleDateString('ar-EG', { weekday: 'short' })
                const dayNum = date.getDate()
                const monthName = date.toLocaleDateString('ar-EG', { month: 'short' })
                const isToday = new Date().toDateString() === date.toDateString()
                const isFirstOfMonth = dayNum === 1

                return {
                  html: `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2; padding: 2px 0; gap: 1px;">
                      <span style="font-size: 12px; font-weight: 600; color: ${isToday ? '#78350f' : '#64748b'}; letter-spacing: 0.02em;">${dayName}</span>
                      <span style="font-size: 20px; font-weight: 900; color: ${isToday ? '#92400e' : isFirstOfMonth ? '#1d4ed8' : '#1e293b'};">${dayNum}</span>
                      <span style="font-size: 12px; font-weight: 700; color: ${isToday ? '#a16207' : isFirstOfMonth ? '#3b82f6' : '#94a3b8'};">${monthName}</span>
                    </div>
                  `
                }
              }}
              slotLabelDidMount={(arg) => {
                // Mark the 1st of each month with a visual separator
                const date = arg.date
                if (date && date.getDate() === 1) {
                  arg.el.classList.add('fc-month-start')
                }
              }}
              slotLaneDidMount={(arg) => {
                // Mark lane cells on the 1st of each month
                const date = arg.date
                if (date && date.getDate() === 1) {
                  arg.el.classList.add('fc-month-start-lane')
                }
              }}
              select={handleDateSelect}
              eventClick={handleEventClick}
              resourceLabelContent={(arg) => {
                const unitType = arg.resource.extendedProps?.type || ''
                const unitObj = arg.resource.extendedProps?.unit
                const isMaintenance = unitObj?.status === 'maintenance'
                const iconData = getUnitTypeIconData(unitType)
                const shakkaGradient = !isMaintenance
                  ? getShakkaRoomIconGradient(unitObj)
                  : null
                const iconGradient = shakkaGradient ?? iconData.gradient
                
                const maintenanceBadge = isMaintenance
                  ? `<span style="
                      display: inline-flex;
                      align-items: center;
                      gap: 3px;
                      font-size: 10px;
                      font-weight: 700;
                      color: #92400e;
                      background: linear-gradient(135deg, #fde68a 0%, #fbbf24 100%);
                      padding: 2px 8px;
                      border-radius: 9999px;
                      border: 1px solid #f59e0b;
                      white-space: nowrap;
                    ">🔧 صيانة</span>`
                  : ''

                return {
                  html: `
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 8px 4px; flex-wrap: wrap;">
                      <span style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        width: 48px;
                        height: 48px;
                        border-radius: 10px;
                        background: ${isMaintenance ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : iconGradient};
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                      ">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          ${iconData.path}
                        </svg>
                      </span>
                      <span style="font-weight: 600; color: ${isMaintenance ? '#92400e' : 'rgba(59, 130, 246, 0.9)'}; white-space: nowrap; font-size: 20px;">${arg.resource.title}</span>
                      ${maintenanceBadge}
                    </div>
                  `
                }
              }}
              eventContent={(arg) => {
                const reservation = arg.event.extendedProps.reservation as CalendarEventRow | undefined
                if (reservation) {
                  const guestName = `${reservation.guest_first_name_ar || reservation.guest_first_name || ''} ${reservation.guest_last_name_ar || reservation.guest_last_name || ''}`.trim() || reservation.id.substring(0, 8)
                  const phone = reservation.guest_phone || ''

                  const checkIn = new Date(reservation.check_in_date)
                  const checkOut = new Date(reservation.check_out_date)
                  const diffDays = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
                  const isSingleDay = diffDays <= 1

                  return {
                    html: `
                      <div class="cal-event-content ${isSingleDay ? 'single-day-event' : ''}">
                        <div class="cal-event-name">${guestName}</div>
                        ${phone ? `<div class="cal-event-phone">📞 ${phone}</div>` : ''}
                      </div>
                    `
                  }
                }
                // Maintenance events
                if (arg.event.extendedProps.isMaintenance) {
                  return { html: `<div class="cal-event-content"><div class="cal-event-name" style="color: #78350f;">🔧 صيانة</div></div>` }
                }
                // Room block events: use default title
                return { html: `<div class="cal-event-content"><div class="cal-event-name">${arg.event.title}</div></div>` }
              }}
              eventDidMount={(arg) => {
                // Maintenance events: add tooltip, skip delete button
                if (arg.event.extendedProps.isMaintenance) {
                  arg.el.setAttribute('title', 'هذه الوحدة قيد الصيانة')
                  return
                }

                // Add delete button to event (hidden for restricted BranchManagers only)
                const isRestrictedBM =
                  hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
                arg.el.classList.add('group', 'relative')
                arg.el.style.position = 'relative'
                
                if (!isRestrictedBM && !arg.el.querySelector('.fc-event-delete-btn')) {
                  const deleteBtn = document.createElement('button')
                  deleteBtn.innerHTML = '🗑️'
                  deleteBtn.className = 'fc-event-delete-btn'
                  const isRoomBlock = !!arg.event.extendedProps.roomBlock
                  deleteBtn.setAttribute('title', isRoomBlock ? 'حذف الحظر' : 'حذف الحجز (أو اضغط Ctrl+Click)')
                  deleteBtn.style.cssText = `
                    position: absolute;
                    left: 2px;
                    top: 2px;
                    z-index: 50;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    border: 2px solid white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    opacity: 0;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
                  `
                  
                  arg.el.addEventListener('mouseenter', () => {
                    deleteBtn.style.opacity = '1'
                    deleteBtn.style.transform = 'scale(1.15)'
                  })
                  arg.el.addEventListener('mouseleave', () => {
                    deleteBtn.style.opacity = '0'
                    deleteBtn.style.transform = 'scale(1)'
                  })
                  
                  deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                    deleteBtn.style.transform = 'scale(1.25)'
                    deleteBtn.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.6)'
                  })
                  deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    deleteBtn.style.transform = 'scale(1.15)'
                    deleteBtn.style.boxShadow = '0 2px 6px rgba(239, 68, 68, 0.4)'
                  })
                  
                  deleteBtn.onclick = (e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    const roomBlock = arg.event.extendedProps.roomBlock
                    if (roomBlock) {
                      setBlockToDelete(roomBlock)
                      setBlockDeleteDialogOpen(true)
                      return
                    }
                    const reservation = arg.event.extendedProps.reservation as CalendarEventRow
                    if (reservation) {
                      setReservationToDelete(reservation)
                      setDeleteDialogOpen(true)
                    }
                  }
                  
                  arg.el.appendChild(deleteBtn)
                }

                // Add "Change Unit" button for reservation events only (not room blocks)
                const isReservationEvent = !!arg.event.extendedProps.reservation && !arg.event.extendedProps.roomBlock
                if (isReservationEvent && !arg.el.querySelector('.fc-event-change-unit-btn')) {
                  const changeUnitBtn = document.createElement('button')
                  changeUnitBtn.innerHTML = '🔄'
                  changeUnitBtn.className = 'fc-event-change-unit-btn'
                  changeUnitBtn.setAttribute('title', 'نقل إلى وحدة أخرى')
                  changeUnitBtn.style.cssText = `
                    position: absolute;
                    left: 26px;
                    top: 2px;
                    z-index: 50;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
                    color: white;
                    border: 2px solid white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    opacity: 0;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4);
                  `

                  arg.el.addEventListener('mouseenter', () => {
                    changeUnitBtn.style.opacity = '1'
                    changeUnitBtn.style.transform = 'scale(1.15)'
                  })
                  arg.el.addEventListener('mouseleave', () => {
                    changeUnitBtn.style.opacity = '0'
                    changeUnitBtn.style.transform = 'scale(1)'
                  })

                  changeUnitBtn.addEventListener('mouseenter', () => {
                    changeUnitBtn.style.background = 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)'
                    changeUnitBtn.style.transform = 'scale(1.25)'
                    changeUnitBtn.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.6)'
                  })
                  changeUnitBtn.addEventListener('mouseleave', () => {
                    changeUnitBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
                    changeUnitBtn.style.transform = 'scale(1.15)'
                    changeUnitBtn.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.4)'
                  })

                  changeUnitBtn.onclick = (e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    const res = arg.event.extendedProps.reservation as CalendarEventRow
                    if (res) {
                      setChangeUnitReservation(res)
                      setChangeUnitDialogOpen(true)
                    }
                  }

                  arg.el.appendChild(changeUnitBtn)
                }

                // Add "open in new tab" button for reservation events
                if (isReservationEvent && !arg.el.querySelector('.fc-event-open-tab-btn')) {
                  const openTabBtn = document.createElement('button')
                  openTabBtn.innerHTML = '↗'
                  openTabBtn.className = 'fc-event-open-tab-btn'
                  openTabBtn.setAttribute('title', 'فتح في تبويب جديد')
                  openTabBtn.style.cssText = `
                    position: absolute;
                    left: 50px;
                    top: 2px;
                    z-index: 50;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    border: 2px solid white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    font-weight: 900;
                    opacity: 0;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
                  `

                  arg.el.addEventListener('mouseenter', () => {
                    openTabBtn.style.opacity = '1'
                    openTabBtn.style.transform = 'scale(1.15)'
                  })
                  arg.el.addEventListener('mouseleave', () => {
                    openTabBtn.style.opacity = '0'
                    openTabBtn.style.transform = 'scale(1)'
                  })

                  openTabBtn.addEventListener('mouseenter', () => {
                    openTabBtn.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    openTabBtn.style.transform = 'scale(1.25)'
                    openTabBtn.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.6)'
                  })
                  openTabBtn.addEventListener('mouseleave', () => {
                    openTabBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    openTabBtn.style.transform = 'scale(1.15)'
                    openTabBtn.style.boxShadow = '0 2px 6px rgba(16, 185, 129, 0.4)'
                  })

                  openTabBtn.onclick = (e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    const res = arg.event.extendedProps.reservation as CalendarEventRow
                    if (res?.id) {
                      window.open(`/reservations/${res.id}`, '_blank')
                    }
                  }

                  arg.el.appendChild(openTabBtn)
                }

                // Pending sync badge — shown on events that are queued in the outbox.
                if (isReservationEvent) {
                  const res = arg.event.extendedProps.reservation as CalendarEventRow
                  if (res?.id && pendingIds.has(res.id) && !arg.el.querySelector('.fc-event-pending-badge')) {
                    const badge = document.createElement('span')
                    badge.className = 'fc-event-pending-badge'
                    badge.setAttribute('title', 'معلق — سيُزامن عند الاتصال')
                    badge.style.cssText = `
                      position: absolute;
                      top: -4px;
                      right: -4px;
                      z-index: 60;
                      width: 14px;
                      height: 14px;
                      border-radius: 50%;
                      background: #f59e0b;
                      border: 2px solid white;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 8px;
                      color: white;
                      font-weight: 900;
                      pointer-events: none;
                    `
                    badge.textContent = '⏱'
                    arg.el.style.position = 'relative'
                    arg.el.appendChild(badge)
                  }
                }

                // Add right-click tooltip for reservations
                const reservation = arg.event.extendedProps.reservation as CalendarEventRow | undefined
                if (reservation) {
                  // Helper: build tooltip HTML from the latest reservation data
                  const statusMap: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', checked_in: 'تم تسجيل الدخول', checked_out: 'تم تسجيل الخروج', cancelled: 'ملغي', no_show: 'لم يحضر' }
                  const guestTypeMap: Record<string, string> = { military: 'عسكري', civilian: 'مدني', club_member: 'عضو دار', artillery_family: 'ابناء مدفعية' }

                  function buildTooltipHTML(res: CalendarEventRow): string {
                    const gName = `${res.guest_first_name_ar || res.guest_first_name || ''} ${res.guest_last_name_ar || res.guest_last_name || ''}`.trim()
                    const ph = res.guest_phone || ''
                    const cIn = res.check_in_date ? new Date(res.check_in_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
                    const cOut = res.check_out_date ? new Date(res.check_out_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
                    const cAt = res.created_at ? new Date(res.created_at).toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''
                    const st = res.status || ''
                    const gType = ''
                    const notes = res.notes || ''
                    const creatorUserId = res.created_by_user_id
                    const creatorName = creatorUserId ? (staffByUserId.get(creatorUserId) || creatorUserId.substring(0, 8) + '...') : null
                    return `
                      <button class="fc-tooltip-close" style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);color:#f1f5f9;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:background 0.15s;">&times;</button>
                      <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; color: #60a5fa; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        👤 ${gName || res.id.substring(0, 8)}
                      </div>
                      ${ph ? `<div style="margin-bottom: 4px;">📞 <span style="color: #a5b4fc;">${ph}</span></div>` : ''}
                      ${gType ? `<div style="margin-bottom: 4px;">🏷️ نوع الضيف: <span style="color: #38bdf8;">${guestTypeMap[gType] || gType}</span></div>` : ''}
                      <div style="margin-bottom: 4px;">📅 الدخول: <span style="color: #34d399;">${cIn}</span></div>
                      <div style="margin-bottom: 4px;">📅 الخروج: <span style="color: #fb923c;">${cOut}</span></div>
                      ${st ? `<div style="margin-bottom: 4px;">📌 الحالة: <span style="color: #c084fc;">${statusMap[st] || st}</span></div>` : ''}
                      ${notes ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">📝 ملاحظات: <span style="color: #fde68a;">${notes}</span></div>` : ''}
                      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">👷 بواسطة: <span style="color: #67e8f9;">${creatorName || 'غير محدد'}</span></div>
                      ${cAt ? `<div style="margin-top: 4px; font-size: 11px; color: #94a3b8;">🕐 تاريخ الإنشاء: ${cAt}</div>` : ''}
                    `
                  }

                  const tooltip = document.createElement('div')
                  tooltip.className = 'fc-event-tooltip'
                  tooltip.style.cssText = `
                    display: none;
                    position: fixed;
                    z-index: 99999;
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    color: #f1f5f9;
                    border-radius: 12px;
                    padding: 14px 18px;
                    font-size: 13px;
                    line-height: 1.7;
                    min-width: 240px;
                    max-width: 320px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
                    pointer-events: auto;
                    direction: rtl;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.1);
                  `
                  document.body.appendChild(tooltip)

                  // Toggle tooltip on right-click — rebuild HTML fresh each time
                  arg.el.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // If this tooltip is already visible, hide it (toggle)
                    if (tooltip.style.display === 'block') {
                      tooltip.style.display = 'none'
                      return
                    }
                    // Hide all other tooltips first
                    document.querySelectorAll('.fc-event-tooltip').forEach(el => {
                      (el as HTMLElement).style.display = 'none'
                    })
                    // Rebuild tooltip content from the LATEST extendedProps data
                    const latestRes = arg.event.extendedProps.reservation as CalendarEventRow
                    tooltip.innerHTML = buildTooltipHTML(latestRes)
                    // Re-attach close button listener
                    const closeBtn = tooltip.querySelector('.fc-tooltip-close') as HTMLElement
                    if (closeBtn) {
                      closeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); tooltip.style.display = 'none' })
                      closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(239,68,68,0.6)' })
                      closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(255,255,255,0.15)' })
                    }
                    tooltip.style.display = 'block'
                    const x = e.clientX + 12
                    const y = e.clientY + 12
                    // Keep tooltip within viewport
                    const rect = tooltip.getBoundingClientRect()
                    tooltip.style.left = (x + rect.width > window.innerWidth ? e.clientX - rect.width - 12 : x) + 'px'
                    tooltip.style.top = (y + rect.height > window.innerHeight ? e.clientY - rect.height - 12 : y) + 'px'
                  })

                  // Cleanup tooltip when event unmounts
                  const observer = new MutationObserver(() => {
                    if (!document.body.contains(arg.el)) {
                      tooltip.remove()
                      observer.disconnect()
                    }
                  })
                  observer.observe(arg.el.parentNode || document.body, { childList: true })
                } else if (arg.event.extendedProps.roomBlock) {
                  // Add right-click tooltip for room blocks
                  const block = arg.event.extendedProps.roomBlock
                  const blockName = block.name_ar || block.name || ''
                  const startDate = block.start_date ? new Date(block.start_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
                  const endDate = block.end_date ? new Date(block.end_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
                  const reason = block.reason_ar || block.reason || ''
                  const blockUnits = block.units?.map((u: any) => {
                    const unit = u.unit
                    return unit ? `${unit.unit_number} - ${unit.name_ar || unit.name || ''}` : ''
                  }).filter(Boolean) || []

                  const blockTooltip = document.createElement('div')
                  blockTooltip.className = 'fc-event-tooltip'
                  blockTooltip.style.cssText = `
                    display: none;
                    position: fixed;
                    z-index: 99999;
                    background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
                    color: #f1f5f9;
                    border-radius: 12px;
                    padding: 14px 18px;
                    font-size: 13px;
                    line-height: 1.7;
                    min-width: 240px;
                    max-width: 340px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.15);
                    pointer-events: auto;
                    direction: rtl;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.15);
                  `
                  blockTooltip.innerHTML = `
                    <button class="fc-tooltip-close" style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);color:#f1f5f9;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:background 0.15s;">&times;</button>
                    <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; color: #f87171; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                      🚫 ${blockName}
                    </div>
                    <div style="margin-bottom: 4px;">📅 من: <span style="color: #34d399;">${startDate}</span></div>
                    <div style="margin-bottom: 4px;">📅 إلى: <span style="color: #fb923c;">${endDate}</span></div>
                    ${reason ? `<div style="margin-bottom: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">📋 السبب: <span style="color: #fbbf24;">${reason}</span></div>` : ''}
                    ${blockUnits.length > 0 ? `
                      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div style="margin-bottom: 4px; color: #a5b4fc;">🏠 الوحدات المحظورة (${blockUnits.length}):</div>
                        ${blockUnits.map((u: string) => `<div style="margin-right: 12px; font-size: 12px; color: #cbd5e1;">• ${u}</div>`).join('')}
                      </div>
                    ` : ''}
                  `
                  // X close button click
                  const blockCloseBtn = blockTooltip.querySelector('.fc-tooltip-close') as HTMLElement
                  if (blockCloseBtn) {
                    blockCloseBtn.addEventListener('click', (ev) => { ev.stopPropagation(); blockTooltip.style.display = 'none' })
                    blockCloseBtn.addEventListener('mouseenter', () => { blockCloseBtn.style.background = 'rgba(239,68,68,0.6)' })
                    blockCloseBtn.addEventListener('mouseleave', () => { blockCloseBtn.style.background = 'rgba(255,255,255,0.15)' })
                  }
                  document.body.appendChild(blockTooltip)

                  // Toggle tooltip on right-click
                  arg.el.addEventListener('contextmenu', (e: MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // If this tooltip is already visible, hide it (toggle)
                    if (blockTooltip.style.display === 'block') {
                      blockTooltip.style.display = 'none'
                      return
                    }
                    document.querySelectorAll('.fc-event-tooltip').forEach(el => {
                      (el as HTMLElement).style.display = 'none'
                    })
                    blockTooltip.style.display = 'block'
                    const x = e.clientX + 12
                    const y = e.clientY + 12
                    const rect = blockTooltip.getBoundingClientRect()
                    blockTooltip.style.left = (x + rect.width > window.innerWidth ? e.clientX - rect.width - 12 : x) + 'px'
                    blockTooltip.style.top = (y + rect.height > window.innerHeight ? e.clientY - rect.height - 12 : y) + 'px'
                  })

                  // Cleanup tooltip when event unmounts
                  const blockObserver = new MutationObserver(() => {
                    if (!document.body.contains(arg.el)) {
                      blockTooltip.remove()
                      blockObserver.disconnect()
                    }
                  })
                  blockObserver.observe(arg.el.parentNode || document.body, { childList: true })
                }
              }}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              height="700px"
              contentHeight="auto"
              expandRows={false}
              stickyFooterScrollbar={true}
              eventClassNames="border-l-4 shadow-md cursor-pointer font-semibold"
              dayHeaderClassNames="font-bold text-slate-700 dark:text-slate-300 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-purple-50/30 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 border-b-2 border-blue-200/50 dark:border-blue-800/50"
              moreLinkClassNames="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold"
              buttonText={{
                today: 'اليوم',
                month: 'شهر',
                week: 'أسبوع',
                day: 'يوم',
              }}
              allDayText="طوال اليوم"
              noEventsText="لا توجد أحداث"
              eventDisplay="block"
              dayCellClassNames="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors"
            />
          </div>
        </div>
      </motion.div>

      {/* Guest Selection Dialog */}
      <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 bg-gradient-to-br from-blue-50/60 via-purple-50/40 to-pink-50/40 dark:from-slate-900 dark:via-blue-950/30 dark:to-purple-950/20 border-2 border-blue-200/60 dark:border-blue-700/50 shadow-2xl">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-blue-100/80 dark:border-blue-800/50 shrink-0 bg-gradient-to-r from-white/80 via-blue-50/60 to-indigo-50/60 dark:from-slate-900/80 dark:via-blue-950/40 dark:to-indigo-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shrink-0">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  إنشاء حجز جديد
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  اختر التواريخ والوحدة ثم الضيف لإكمال الحجز
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <GuestSelectionDialog
              guests={guests || []}
              units={units || []}
              initialUnitId={pendingReservation?.unitId || ''}
              initialCheckIn={pendingReservation?.checkIn || ''}
              initialCheckOut={pendingReservation?.checkOut || ''}
              onCreateGuest={createGuest}
              onSelectGuest={(guestId, unitIds, notesValue, checkIn, checkOut) => {
                handleCreateReservation(guestId, unitIds, notesValue, checkIn, checkOut)
              }}
              onCancel={() => {
                setGuestDialogOpen(false)
                setPendingReservation(null)
                setNewGuestCreated(null)
              }}
              newGuestCreated={newGuestCreated}
              onGuestCreated={handleGuestCreated}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Drag/Resize Change Dialog */}
      <Dialog open={!!pendingEventChange} onOpenChange={(open) => { if (!open) cancelEventChange() }}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-gradient-to-br from-white via-amber-50/50 to-orange-50/50 dark:from-slate-900 dark:via-amber-950/20 dark:to-orange-950/20 backdrop-blur-xl !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear_gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          <DialogHeader className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent flex items-center justify-center gap-3">
                <motion.div
                  className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <AlertTriangle className="h-6 w-6 text-white" />
                </motion.div>
                تأكيد تعديل الحجز
              </DialogTitle>
            </motion.div>
          </DialogHeader>
          <div className="relative z-10 py-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 dark:border-amber-800">
                <p className="text-base font-medium text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {pendingEventChange?.description}
                </p>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                هل أنت متأكد من هذا التعديل؟
              </p>
            </motion.div>
          </div>
          <div className="relative z-10 flex gap-3 pt-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Button
                onClick={confirmEventChange}
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg"
              >
                <Check className="mr-2 h-5 w-5" />
                نعم، تأكيد
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Button
                variant="outline"
                onClick={cancelEventChange}
                className="w-full h-12 text-base font-bold border-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                لا، تراجع
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Unit Dialog */}
      <Dialog open={changeUnitDialogOpen} onOpenChange={(open) => { if (!open) { setChangeUnitDialogOpen(false); setChangeUnitReservation(null); setChangeUnitSearch('') } }}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:via-blue-950/20 dark:to-indigo-950/20 backdrop-blur-xl !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          <DialogHeader className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center justify-center gap-3">
                <motion.div
                  className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Home className="h-6 w-6 text-white" />
                </motion.div>
                نقل الحجز إلى وحدة أخرى
              </DialogTitle>
            </motion.div>
          </DialogHeader>
          <div className="relative z-10 py-2 space-y-3">
            {/* Search bar */}
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="h-4 w-4 text-blue-500" />
              </div>
              <Input
                placeholder="ابحث عن وحدة... (رقم، اسم، نوع)"
                value={changeUnitSearch}
                onChange={(e) => setChangeUnitSearch(e.target.value)}
                className="pr-10 h-10 text-sm border-2 border-blue-200 dark:border-blue-800 rounded-xl bg-white/80 dark:bg-slate-900/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-center placeholder:text-slate-400"
              />
            </div>
            {/* Unit list */}
            <div className="max-h-72 overflow-y-auto space-y-2 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-3 bg-white/80 dark:bg-slate-900/80">
              {(() => {
                const typeMap: Record<string, string> = { room: 'غرفة', suite: 'سويت', chalet: 'شاليه', duplex: 'دوبلكس', villa: 'فيلا', apartment: 'شقة' }
                const searchLower = changeUnitSearch.trim().toLowerCase()
                const filtered = units
                  ?.filter(u =>
                    filteredUnitIds.has(u.id) &&
                    u.status !== 'maintenance'
                  )
                  .filter(u => {
                    if (!searchLower) return true
                    const typeAr = typeMap[u.type] || ''
                    return (
                      (u.unit_number || '').toLowerCase().includes(searchLower) ||
                      (u.name_ar || '').toLowerCase().includes(searchLower) ||
                      (u.name || '').toLowerCase().includes(searchLower) ||
                      (u.type || '').toLowerCase().includes(searchLower) ||
                      typeAr.includes(searchLower)
                    )
                  })
                  .sort((a, b) => parseInt(a.unit_number || '0') - parseInt(b.unit_number || '0'))

                if (!filtered || filtered.length === 0) {
                  return <p className="text-center text-sm text-slate-400 py-4">لا توجد وحدات متاحة في هذا الموقع</p>
                }

                return filtered.map(u => {
                  const isCurrent = u.id === changeUnitReservation?.unit_id
                  return (
                    <motion.button
                      key={u.id}
                      whileHover={isCurrent ? {} : { scale: 1.01 }}
                      whileTap={isCurrent ? {} : { scale: 0.99 }}
                      onClick={() => { if (!isCurrent) handleChangeUnit(u.id) }}
                      disabled={changingUnit || isCurrent}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-right ${
                        isCurrent
                          ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-400/50 cursor-default'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0 ${
                        isCurrent
                          ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                      }`}>
                        {u.unit_number}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-sm">{typeMap[u.type] || u.type}</span>
                        <span className="text-xs text-muted-foreground">{u.name_ar || u.name || ''}</span>
                      </div>
                      {isCurrent ? (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                          الوحدة الحالية
                        </span>
                      ) : (
                        <ChevronLeft className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      )}
                    </motion.button>
                  )
                })
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-gradient-to-br from-white via-red-50/50 to-orange-50/50 dark:from-slate-900 dark:via-red-950/20 dark:to-orange-950/20 backdrop-blur-xl">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              تأكيد الحذف
            </DialogTitle>
            <DialogDescription className="text-center text-base mt-4">
              هل أنت متأكد من حذف هذا الحجز؟
            </DialogDescription>
            {reservationToDelete && (
              <div className="space-y-2 mt-4 text-center">
                <div className="text-lg font-bold text-red-600 dark:text-red-400 py-2 px-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  {reservationToDelete.id.substring(0, 8)}…
                </div>
                <div className="text-sm text-muted-foreground">
                  {reservationToDelete.guest_first_name_ar || reservationToDelete.guest_first_name} {reservationToDelete.guest_last_name_ar || reservationToDelete.guest_last_name}
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف جميع البيانات المرتبطة بهذا الحجز بشكل دائم.
            </p>
          </DialogHeader>
          <DialogFooter className="relative z-10 mt-6 sm:flex-row sm:justify-center gap-3">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => setDeleteDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all"
              onClick={handleDeleteReservation}
              disabled={deleteReservation.isPending}
            >
              {deleteReservation.isPending ? 'جاري الحذف...' : 'حذف نهائي'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Block Detail & Delete Dialog */}
      <Dialog open={blockDeleteDialogOpen} onOpenChange={setBlockDeleteDialogOpen}>
        <DialogContent className="max-w-lg border-0 shadow-2xl bg-gradient-to-br from-white via-red-50/50 to-orange-50/50 dark:from-slate-900 dark:via-red-950/20 dark:to-orange-950/20 backdrop-blur-xl">
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              تفاصيل الحظر
            </DialogTitle>
            <DialogDescription className="text-center text-base mt-2">
              هل أنت متأكد من حذف هذا الحظر؟
            </DialogDescription>
          </DialogHeader>
          {blockToDelete && (
            <div className="relative z-10 space-y-4 mt-2">
              {/* Block Name */}
              <div className="text-lg font-bold text-red-600 dark:text-red-400 py-2 px-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 text-center">
                🚫 {blockToDelete.name_ar || blockToDelete.name}
              </div>

              {/* Date Range */}
              <div className="flex items-center justify-center gap-3 text-sm">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <Calendar className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    {new Date(blockToDelete.start_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                  <Calendar className="h-3.5 w-3.5 text-orange-600" />
                  <span className="text-orange-700 dark:text-orange-300 font-medium">
                    {new Date(blockToDelete.end_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Reason */}
              {(blockToDelete.reason_ar || blockToDelete.reason) && (
                <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">📋 السبب:</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{blockToDelete.reason_ar || blockToDelete.reason}</p>
                </div>
              )}

              {/* Blocked Units List */}
              {blockToDelete.units && blockToDelete.units.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">🏠 الوحدات المحظورة ({blockToDelete.units.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {blockToDelete.units.map((unitLink: any) => (
                      <span
                        key={unitLink.unit?.id || Math.random()}
                        className="px-2.5 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-800"
                      >
                        {unitLink.unit?.unit_number} - {unitLink.unit?.name_ar || unitLink.unit?.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center pt-2 border-t border-slate-200 dark:border-slate-700">
                لا يمكن التراجع عن هذا الإجراء. سيتم حذف الحظر بشكل دائم.
              </p>
            </div>
          )}
          <DialogFooter className="relative z-10 mt-4 sm:flex-row sm:justify-center gap-3">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => setBlockDeleteDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all"
              onClick={() => {
                if (blockToDelete?.id) {
                  deleteRoomBlock.mutate(blockToDelete.id)
                }
              }}
              disabled={deleteRoomBlock.isPending}
            >
              {deleteRoomBlock.isPending ? 'جاري الحذف...' : 'حذف نهائي'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const GuestSelectionDialog = React.memo(function GuestSelectionDialog({
  guests: guestsProp,
  units,
  initialUnitId = '',
  initialCheckIn = '',
  initialCheckOut = '',
  onCreateGuest,
  onSelectGuest,
  onCancel,
  newGuestCreated,
  onGuestCreated,
}: {
  guests: any[]
  units: any[]
  initialUnitId?: string
  initialCheckIn?: string
  initialCheckOut?: string
  onCreateGuest: any
  onSelectGuest: (guestId: string, unitIds: string[], notes: string, checkIn: string, checkOut: string) => void
  onCancel: () => void
  newGuestCreated: string | null
  onGuestCreated: () => void
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [unitSearch, setUnitSearch] = useState('')
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(initialUnitId ? [initialUnitId] : [])
  const [showNewGuestForm, setShowNewGuestForm] = useState(false)
  const [visibleCount, setVisibleCount] = useState(30)
  const [notes, setNotes] = useState('')
  const [checkInDraft, setCheckInDraft] = useState(initialCheckIn)
  const [checkOutDraft, setCheckOutDraft] = useState(initialCheckOut)
  const [pendingGuest, setPendingGuest] = useState<any | null>(null)
  const queryClient = useQueryClient()

  // Sync date drafts when dialog reopens with new dates
  useEffect(() => {
    setCheckInDraft(initialCheckIn)
    setCheckOutDraft(initialCheckOut)
  }, [initialCheckIn, initialCheckOut])

  const datesValid = useMemo(() => {
    if (!checkInDraft || !checkOutDraft) return false
    return new Date(checkOutDraft) > new Date(checkInDraft)
  }, [checkInDraft, checkOutDraft])

  const nights = useMemo(() => {
    if (!datesValid) return 0
    return Math.ceil((new Date(checkOutDraft).getTime() - new Date(checkInDraft).getTime()) / 86400000)
  }, [checkInDraft, checkOutDraft, datesValid])

  // Reset visible count when search changes so first paint stays cheap.
  useEffect(() => { setVisibleCount(30) }, [debouncedSearch])

  // Update selectedUnitIds and reset notes when initialUnitId changes (dialog reopens)
  useEffect(() => {
    if (initialUnitId) {
      setSelectedUnitIds([initialUnitId])
      setNotes('')
    }
  }, [initialUnitId])

  // Debounce the guest search so each keystroke doesn't fire a Supabase query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    )
  }

  // Server-side search across the full guests table.
  const { data: guestsData } = useGuests(debouncedSearch || undefined)
  const guests = guestsData || guestsProp

  const filteredUnits = useMemo(() => {
    if (!unitSearch) return units
    const q = unitSearch.toLowerCase()
    return units.filter(
      (unit) =>
        unit.unit_number?.toLowerCase().includes(q) ||
        unit.name?.toLowerCase().includes(q) ||
        unit.name_ar?.includes(unitSearch) ||
        unit.type?.toLowerCase().includes(q)
    )
  }, [units, unitSearch])

  const filteredGuests = useMemo(() => {
    if (!search) return guests
    const q = search.toLowerCase()
    const digits = search.replace(/[\u0660-\u0669]/g, (d) =>
      String(d.charCodeAt(0) - 0x0660)
    )
    return guests.filter(
      (g) =>
        g.first_name?.toLowerCase().includes(q) ||
        g.last_name?.toLowerCase().includes(q) ||
        g.first_name_ar?.includes(search) ||
        g.last_name_ar?.includes(search) ||
        g.phone?.includes(digits) ||
        g.email?.toLowerCase().includes(q) ||
        g.national_id?.includes(digits)
    )
  }, [guests, search])

  const visibleGuests = useMemo(() => filteredGuests.slice(0, visibleCount), [filteredGuests, visibleCount])
  const hasMore = filteredGuests.length > visibleCount

  if (pendingGuest) {
    const guestName = `${pendingGuest.first_name_ar || pendingGuest.first_name || ''} ${pendingGuest.last_name_ar || pendingGuest.last_name || ''}`.trim()
    const selectedUnits = units.filter(u => selectedUnitIds.includes(u.id))
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/20 p-5 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                تأكيد الحجز
              </h3>
              <p className="text-xs text-muted-foreground">يرجى التحقق من البيانات قبل التأكيد</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'الضيف', value: guestName },
              { label: 'عدد الوحدات', value: `${selectedUnits.length} وحدة` },
              { label: 'تاريخ الدخول', value: checkInDraft },
              { label: 'تاريخ الخروج', value: checkOutDraft },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white/70 dark:bg-slate-800/60 border border-emerald-100 dark:border-emerald-800/40 p-2.5 space-y-0.5">
                <div className="text-xs text-muted-foreground font-medium">{label}</div>
                <div className="font-bold text-sm truncate">{value}</div>
              </div>
            ))}
            <div className="col-span-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-200 dark:border-emerald-800/40 p-2.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">عدد الليالي</span>
              <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{nights} {nights === 1 ? 'ليلة' : 'ليالٍ'}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedUnits.map(u => (
              <span key={u.id} className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200/60 dark:border-blue-700/40">
                وحدة {u.unit_number}
              </span>
            ))}
          </div>

          {notes && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-xs">
              <span className="font-bold text-amber-800 dark:text-amber-300">ملاحظات: </span>
              <span className="text-amber-900 dark:text-amber-200">{notes}</span>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-3 border-t border-emerald-100 dark:border-emerald-800/50 bg-gradient-to-r from-white/95 via-emerald-50/80 to-teal-50/80 dark:from-slate-900/95 dark:via-emerald-950/60 dark:to-teal-950/60 backdrop-blur flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPendingGuest(null)}
            className="flex-1 h-10 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            رجوع
          </Button>
          <Button
            onClick={() => {
              onSelectGuest(pendingGuest.id, selectedUnitIds, notes, checkInDraft, checkOutDraft)
              setPendingGuest(null)
            }}
            className="flex-1 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold shadow-lg hover:shadow-xl transition-all hover:scale-[1.01]"
          >
            <Check className="h-4 w-4 ml-2" />
            تأكيد الحجز
          </Button>
        </div>
      </div>
    )
  }

  if (showNewGuestForm) {
    return (
      <div className="space-y-4 p-4">
        <div className="border rounded-xl p-5 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">إضافة ضيف جديد</h3>
          </div>
          <GuestForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['guests'] })
              setTimeout(() => {
                onGuestCreated()
                setShowNewGuestForm(false)
                toast({
                  title: 'نجح',
                  description: 'تم إنشاء الضيف بنجاح. يرجى اختياره من القائمة.',
                })
              }, 500)
            }}
          />
        </div>
        <Button variant="outline" onClick={() => setShowNewGuestForm(false)} className="w-full">
          رجوع
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* 1. Dates */}
      <section className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/80 to-green-50/60 dark:from-emerald-950/30 dark:to-green-950/20 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 p-4 shadow-sm space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">١</span>
          <CalendarDays className="h-4 w-4 text-emerald-500" />
          تواريخ الحجز *
          {datesValid && (
            <span className="mr-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm">
              {nights} {nights === 1 ? 'ليلة' : 'ليالٍ'}
            </span>
          )}
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">تاريخ الدخول</Label>
            <Input
              type="date"
              value={checkInDraft}
              onChange={(e) => setCheckInDraft(e.target.value)}
              className="h-9 text-sm border-emerald-200 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500/20 bg-white/80 dark:bg-slate-900/60"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">تاريخ الخروج</Label>
            <Input
              type="date"
              value={checkOutDraft}
              onChange={(e) => setCheckOutDraft(e.target.value)}
              className="h-9 text-sm border-emerald-200 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500/20 bg-white/80 dark:bg-slate-900/60"
            />
          </div>
        </div>
        {checkInDraft && checkOutDraft && !datesValid && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5">
            تاريخ الخروج يجب أن يكون بعد تاريخ الدخول
          </p>
        )}
      </section>

      {/* 2. Unit Selection */}
      <section className="rounded-2xl border border-blue-200/60 dark:border-blue-800/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 dark:from-blue-950/30 dark:to-indigo-950/20 ring-1 ring-blue-200/60 dark:ring-blue-800/40 p-4 shadow-sm space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">٢</span>
          <Home className="h-4 w-4 text-blue-500" />
          اختر الوحدة *
        </Label>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث عن وحدة... (رقم، اسم، نوع)"
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            className="pr-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={filteredUnits.length > 0 && filteredUnits.every(u => selectedUnitIds.includes(u.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUnitIds(prev => [...new Set([...prev, ...filteredUnits.map(u => u.id)])])
                } else {
                  const filteredIds = new Set(filteredUnits.map(u => u.id))
                  setSelectedUnitIds(prev => prev.filter(id => !filteredIds.has(id)))
                }
              }}
              className="w-4 h-4 accent-primary"
            />
            تحديد الكل
          </label>
          {selectedUnitIds.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {selectedUnitIds.length} وحدة محددة
            </span>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-xl p-2 bg-background/60">
          {filteredUnits.length > 0 ? (
            filteredUnits.map((unit) => {
              const isSelected = selectedUnitIds.includes(unit.id)
              return (
                <label
                  key={unit.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-accent ${isSelected ? 'bg-primary/5 ring-2 ring-primary border border-primary' : 'border border-transparent'}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUnit(unit.id)}
                    className="w-4 h-4 accent-primary flex-shrink-0"
                  />
                  <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                    {unit.unit_number}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm truncate">{unit.name_ar || unit.name}</span>
                    <span className="text-xs text-muted-foreground">{unit.type}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
                </label>
              )
            })
          ) : (
            <p className="p-3 text-center text-sm text-muted-foreground">لا توجد وحدات مطابقة</p>
          )}
        </div>
      </section>

      {/* 3. Reservation Notes */}
      <section className="rounded-2xl border border-amber-200/60 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-950/30 dark:to-orange-950/20 ring-1 ring-amber-200/60 dark:ring-amber-800/40 p-4 shadow-sm space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">٣</span>
          <FileText className="h-4 w-4 text-amber-500" />
          ملاحظات الحجز
          <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أضف أي ملاحظات خاصة بالحجز..."
          rows={2}
          className="resize-none text-sm"
        />
      </section>

      {/* 4. Guest Search & List */}
      <section className="rounded-2xl border border-purple-200/60 dark:border-purple-800/50 bg-gradient-to-br from-purple-50/80 to-fuchsia-50/60 dark:from-purple-950/30 dark:to-fuchsia-950/20 ring-1 ring-purple-200/60 dark:ring-purple-800/40 p-4 shadow-sm space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold text-purple-800 dark:text-purple-300">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">٤</span>
          <Users className="h-4 w-4 text-purple-500" />
          ابحث عن الضيف
        </Label>
        {selectedUnitIds.length === 0 && (
          <p className="text-xs text-muted-foreground bg-muted/40 border border-dashed border-border rounded-lg px-3 py-2">
            يرجى اختيار وحدة أولاً قبل اختيار الضيف
          </p>
        )}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف أو البريد..."
            className="pr-9 h-9 text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-56 overflow-y-auto space-y-1">
          {visibleGuests.length > 0 ? (
            <>
              {visibleGuests.map((guest) => {
                const name = `${guest.first_name_ar || guest.first_name || ''} ${guest.last_name_ar || guest.last_name || ''}`.trim()
                const sub = guest.phone || guest.email || ''
                const disabled = selectedUnitIds.length === 0
                return (
                  <div
                    key={guest.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onClick={() => {
                      if (disabled) return
                      if (!datesValid || selectedUnitIds.length === 0) {
                        toast({ title: 'تحقق من الإدخال', description: 'تأكد من اختيار وحدة وتاريخ صالح', variant: 'destructive' })
                        return
                      }
                      setPendingGuest(guest)
                    }}
                    onKeyDown={(e) => {
                      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        if (!datesValid || selectedUnitIds.length === 0) return
                        setPendingGuest(guest)
                      }
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-card' : 'cursor-pointer bg-card hover:bg-accent hover:border-primary/40 active:scale-[0.99]'}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{name}</div>
                      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
                      {guest.military_rank_ar && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                          {guest.military_rank_ar}
                        </span>
                      )}
                    </div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                )
              })}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + 30)}
                  className="w-full py-2 text-sm text-primary hover:underline font-medium"
                >
                  عرض المزيد ({filteredGuests.length - visibleCount} متبقي)
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{search ? 'لا توجد نتائج' : 'لا يوجد ضيوف'}</p>
            </div>
          )}
        </div>
      </section>

      {/* Sticky footer */}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-3 mt-1 border-t border-blue-100/80 dark:border-blue-800/50 bg-gradient-to-r from-white/95 via-blue-50/80 to-indigo-50/80 dark:from-slate-900/95 dark:via-blue-950/60 dark:to-indigo-950/60 backdrop-blur flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowNewGuestForm(true)}
          className="flex-1 h-9 text-sm gap-2 border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300"
        >
          <UserPlus className="h-4 w-4" />
          إنشاء ضيف جديد
        </Button>
        <Button variant="ghost" onClick={onCancel} className="h-9 text-sm px-4 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400">
          إلغاء
        </Button>
      </div>
    </div>
  )
})
