'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useLocations } from '@/lib/hooks/use-locations'
import { useUpdateReservation } from '@/lib/hooks/use-reservations'
import {
  useBookingNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useCreateBookingNotification,
} from '@/lib/hooks/use-booking-notifications'
import { useAuth } from '@/contexts/AuthContext'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { fetchWithSupabaseAuth } from '@/lib/api/fetch-with-supabase-auth'
import { formatDateShort, formatCurrency, cn } from '@/lib/utils'
import { RESERVATION_STATUSES } from '@/lib/constants'
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Home,
  Calendar,
  DollarSign,
  Eye,
  CheckCheck,
  FileText,
  ArrowRight,
  MapPin,
  SlidersHorizontal,
  ChevronDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface PendingReservation {
  id: string
  reservation_number: string
  status: string
  check_in_date: string
  check_out_date: string
  total_amount: number
  paid_amount: number
  discount_amount: number
  adults: number
  children: number
  notes: string | null
  source: string
  created_by: string
  created_at: string
  guest: {
    id: string
    first_name: string
    last_name: string
    first_name_ar: string
    last_name_ar: string
    phone: string
    email: string
  }
  unit: {
    id: string
    unit_number: string
    name: string
    location_id?: string
    location: {
      id?: string
      name: string
      name_ar: string
    }
  }
}

const ROCKET_HOTEL_EMAIL = 'rocket@hotel.com'

/** When set (e.g. Vercel), rocket user sees only these location UUIDs; otherwise name heuristics apply. */
const ROCKET_MANAGED_LOCATION_IDS: string[] | null = (() => {
  const raw = process.env.NEXT_PUBLIC_ROCKET_MANAGED_LOCATION_IDS
  if (!raw?.trim()) return null
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
})()

function isRocketHotelUser(email: string | undefined) {
  return (email || '').trim().toLowerCase() === ROCKET_HOTEL_EMAIL
}

/** Rocket Beach + قرية الندي — fallback when NEXT_PUBLIC_ROCKET_MANAGED_LOCATION_IDS is unset. */
function isRocketManagedLocation(loc: { name: string; name_ar: string }) {
  const bundle = `${loc.name} ${loc.name_ar}`.toLowerCase()
  const ar = loc.name_ar || ''
  const rocketBeach = bundle.includes('rocket') && bundle.includes('beach')
  const nadiVillage =
    ar.includes('ندي') || bundle.includes('nadi') || bundle.includes('nada')
  return rocketBeach || nadiVillage
}

const PAGE_SIZE = 15

function sanitizeIlike(q: string): string {
  return q.replace(/\\/g, '').replace(/%/g, '').replace(/_/g, '').trim()
}

export default function PendingReservationsPage() {
  const queryClient = useQueryClient()
  const { user, hasRole, elevatedOps } = useAuth()
  const restrictedBranchManager =
    hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
  const updateReservation = useUpdateReservation()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const createNotification = useCreateBookingNotification()
  const { data: bookingNotifs } = useBookingNotifications()
  const { data: allLocations } = useLocations()
  const [selectedReservation, setSelectedReservation] = useState<PendingReservation | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [checkInFrom, setCheckInFrom] = useState('')
  const [checkInTo, setCheckInTo] = useState('')
  const [checkOutFrom, setCheckOutFrom] = useState('')
  const [checkOutTo, setCheckOutTo] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const locationOptions = useMemo(() => {
    let list = [...(allLocations || [])]
    if (isRocketHotelUser(user?.email)) {
      const rocketIds = ROCKET_MANAGED_LOCATION_IDS
      if (rocketIds) {
        list = list.filter((l) => rocketIds.includes(l.id))
      } else {
        list = list.filter(isRocketManagedLocation)
      }
    }
    return list.sort((a, b) =>
      (a.name_ar || a.name || '').localeCompare(b.name_ar || b.name || '', 'ar')
    )
  }, [allLocations, user?.email])

  useEffect(() => {
    if (locationFilter === 'all') return
    if (!locationOptions.some((l) => l.id === locationFilter)) {
      setLocationFilter('all')
    }
  }, [locationFilter, locationOptions])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    locationFilter,
    statusFilter,
    checkInFrom,
    checkInTo,
    checkOutFrom,
    checkOutTo,
    createdFrom,
    createdTo,
    debouncedSearch,
    restrictedBranchManager,
    user?.id,
  ])

  const rocketLocationIds = useMemo(() => {
    if (!isRocketHotelUser(user?.email)) return null as string[] | null
    return locationOptions.map((l) => l.id)
  }, [user?.email, locationOptions])

  const hasActiveFilters =
    locationFilter !== 'all' ||
    !!searchQuery.trim() ||
    statusFilter !== 'all' ||
    !!checkInFrom ||
    !!checkInTo ||
    !!checkOutFrom ||
    !!checkOutTo ||
    !!createdFrom ||
    !!createdTo

  function clearFilters() {
    setLocationFilter('all')
    setSearchQuery('')
    setStatusFilter('all')
    setCheckInFrom('')
    setCheckInTo('')
    setCheckOutFrom('')
    setCheckOutTo('')
    setCreatedFrom('')
    setCreatedTo('')
  }

  const pendingQueryKey = [
    'pending-reservations',
    restrictedBranchManager ? user?.id : 'all',
    currentPage,
    locationFilter,
    statusFilter,
    checkInFrom,
    checkInTo,
    checkOutFrom,
    checkOutTo,
    createdFrom,
    createdTo,
    debouncedSearch,
    rocketLocationIds?.join(',') ?? '',
  ] as const

  const rocketUserForQuery = isRocketHotelUser(user?.email)

  const { data: pendingPageResult, isLoading } = useQuery({
    queryKey: pendingQueryKey,
    enabled:
      (!rocketUserForQuery || allLocations !== undefined) &&
      (!restrictedBranchManager || !!user?.id),
    queryFn: async (): Promise<{ rows: PendingReservation[]; total: number }> => {
      const select = `
          *,
          guest:guests(id, first_name, last_name, first_name_ar, last_name_ar, phone, email),
          unit:units(id, unit_number, name, location_id, location:locations(id, name, name_ar))
        `

      let allowedUnitIds: string[] | null = null

      const rocketUser = isRocketHotelUser(user?.email)
      if (rocketUser) {
        if (!rocketLocationIds?.length) return { rows: [], total: 0 }
        const { data: ru, error: ruErr } = await supabase
          .from('units')
          .select('id')
          .in('location_id', rocketLocationIds)
          .eq('is_active', true)
        if (ruErr) throw ruErr
        allowedUnitIds = ru?.map((x) => x.id) ?? []
        if (allowedUnitIds.length === 0) return { rows: [], total: 0 }
      }

      if (locationFilter !== 'all') {
        const { data: lu, error: luErr } = await supabase
          .from('units')
          .select('id')
          .eq('location_id', locationFilter)
          .eq('is_active', true)
        if (luErr) throw luErr
        const locIds = lu?.map((x) => x.id) ?? []
        if (allowedUnitIds) {
          allowedUnitIds = allowedUnitIds.filter((id) => locIds.includes(id))
        } else {
          allowedUnitIds = locIds
        }
        if (allowedUnitIds.length === 0) return { rows: [], total: 0 }
      }

      let query = supabase.from('reservations').select(select, { count: 'exact' })

      if (restrictedBranchManager) {
        query = query.eq('created_by', user?.id ?? '')
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter)
        }
      } else if (statusFilter === 'all') {
        query = query.eq('status', 'pending')
      } else {
        query = query.eq('status', statusFilter)
      }

      if (checkInFrom) query = query.gte('check_in_date', checkInFrom)
      if (checkInTo) query = query.lte('check_in_date', checkInTo)
      if (checkOutFrom) query = query.gte('check_out_date', checkOutFrom)
      if (checkOutTo) query = query.lte('check_out_date', checkOutTo)
      if (createdFrom) query = query.gte('created_at', `${createdFrom}T00:00:00`)
      if (createdTo) query = query.lte('created_at', `${createdTo}T23:59:59.999`)

      if (allowedUnitIds) {
        query = query.in('unit_id', allowedUnitIds)
      }

      const qRaw = debouncedSearch
      const q = sanitizeIlike(qRaw).replace(/[,()]/g, '')
      if (q.length > 0) {
        const pat = `%${q}%`
        const { data: guestRows, error: gErr } = await supabase
          .from('guests')
          .select('id')
          .or(
            `first_name.ilike.${pat},last_name.ilike.${pat},first_name_ar.ilike.${pat},last_name_ar.ilike.${pat},phone.ilike.${pat}`
          )
          .limit(200)
        if (gErr) throw gErr
        const gids = guestRows?.map((g) => g.id) ?? []
        if (gids.length > 0) {
          query = query.or(`reservation_number.ilike.${pat},guest_id.in.(${gids.join(',')})`)
        } else {
          query = query.ilike('reservation_number', pat)
        }
      }

      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      query = query.order('created_at', { ascending: false }).range(from, to)

      const { data, error, count } = await query
      if (error) throw error
      return {
        rows: (data || []) as PendingReservation[],
        total: count ?? 0,
      }
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })

  const pendingRows = pendingPageResult?.rows ?? []
  const totalFiltered = pendingPageResult?.total ?? 0
  const totalPages = totalFiltered > 0 ? Math.ceil(totalFiltered / PAGE_SIZE) : 0

  const pageLoading =
    isLoading ||
    (rocketUserForQuery && allLocations === undefined) ||
    (restrictedBranchManager && !user?.id)

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const { data: authUsers } = useQuery({
    queryKey: ['admin-users-for-pending'],
    queryFn: async () => {
      const res = await fetchWithSupabaseAuth('/api/admin/users')
      if (!res.ok) return []
      const json = await res.json()
      return json.users as { id: string; email: string }[]
    },
  })

  const userEmailById = new Map<string, string>()
  authUsers?.forEach(u => userEmailById.set(u.id, u.email))

  function sendReverseNotification(res: PendingReservation, newStatus: 'confirmed' | 'cancelled') {
    if (!user?.id || !res.created_by) return
    const gName = guestName(res.guest)
    const unitInfo = `${res.unit?.unit_number} — ${res.unit?.location?.name_ar || res.unit?.location?.name}`
    const statusLabel = newStatus === 'confirmed' ? 'تم تأكيد' : 'تم رفض'
    const statusIcon = newStatus === 'confirmed' ? '✅' : '❌'
    createNotification.mutate({
      reservation_id: res.id,
      created_by: user.id,
      notify_user_id: res.created_by,
      message: `${statusIcon} ${statusLabel} حجزك | الضيف: ${gName} | الوحدة: ${unitInfo} | ${res.check_in_date} إلى ${res.check_out_date} | المبلغ: ${res.total_amount} ج.م`,
    })
  }

  async function handleConfirm(id: string) {
    try {
      await updateReservation.mutateAsync({ id, status: 'confirmed' as any })
      const notif = bookingNotifs?.find(n => n.reservation_id === id && !n.is_read)
      if (notif) markRead.mutate(notif.id)
      let res: PendingReservation | undefined = pendingRows.find((r) => r.id === id)
      if (!res) {
        const { data } = await supabase
          .from('reservations')
          .select(
            `*, guest:guests(id, first_name, last_name, first_name_ar, last_name_ar, phone, email),
            unit:units(id, unit_number, name, location_id, location:locations(id, name, name_ar))`
          )
          .eq('id', id)
          .maybeSingle()
        if (data) res = data as PendingReservation
      }
      if (res) sendReverseNotification(res, 'confirmed')
      queryClient.invalidateQueries({ queryKey: ['pending-reservations'] })
      toast({ title: 'تم تأكيد الحجز بنجاح' })
    } catch (e: any) {
      toast({ title: 'فشل في تأكيد الحجز', description: e.message, variant: 'destructive' })
    }
  }

  async function handleReject(id: string) {
    try {
      await updateReservation.mutateAsync({ id, status: 'cancelled' as any })
      const notif = bookingNotifs?.find(n => n.reservation_id === id && !n.is_read)
      if (notif) markRead.mutate(notif.id)
      let res: PendingReservation | undefined = pendingRows.find((r) => r.id === id)
      if (!res) {
        const { data } = await supabase
          .from('reservations')
          .select(
            `*, guest:guests(id, first_name, last_name, first_name_ar, last_name_ar, phone, email),
            unit:units(id, unit_number, name, location_id, location:locations(id, name, name_ar))`
          )
          .eq('id', id)
          .maybeSingle()
        if (data) res = data as PendingReservation
      }
      if (res) sendReverseNotification(res, 'cancelled')
      queryClient.invalidateQueries({ queryKey: ['pending-reservations'] })
      toast({ title: 'تم رفض الحجز' })
    } catch (e: any) {
      toast({ title: 'فشل في رفض الحجز', description: e.message, variant: 'destructive' })
    }
  }

  function openDetail(reservation: PendingReservation) {
    setSelectedReservation(reservation)
    setDetailOpen(true)
    const notif = bookingNotifs?.find(n => n.reservation_id === reservation.id && !n.is_read)
    if (notif) markRead.mutate(notif.id)
  }

  function guestName(g: PendingReservation['guest']) {
    return `${g.first_name_ar || g.first_name} ${g.last_name_ar || g.last_name}`.trim()
  }

  function daysBetween(a: string, b: string) {
    return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff'] as any}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              طلبات الحجز
            </h1>
            <p className="text-muted-foreground mt-1">
              {restrictedBranchManager ? 'متابعة حالة طلبات الحجز الخاصة بك' : 'حجوزات بانتظار الموافقة من مدراء الفروع'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(bookingNotifs?.filter(n => !n.is_read).length ?? 0) > 0 && (
              <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
                <CheckCheck className="h-4 w-4 ml-2" />
                قراءة كل الإشعارات
              </Button>
            )}
            <Badge variant="secondary" className="text-sm px-3 py-1 gap-1">
              <Clock className="h-4 w-4 ml-1" />
              {hasActiveFilters
                ? `${totalFiltered.toLocaleString('ar-EG')} نتيجة`
                : `${totalFiltered.toLocaleString('ar-EG')} ${restrictedBranchManager ? 'طلب' : 'حجز معلق'}`}
            </Badge>
          </div>
        </motion.div>

        {/* Filters */}
        {!pageLoading && (totalFiltered > 0 || hasActiveFilters) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-orange-200/60 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/80 via-background to-amber-50/40 dark:from-orange-950/20 dark:to-background shadow-sm overflow-hidden"
          >
            <div className="p-4 md:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-700 dark:text-orange-400">
                    <MapPin className="h-4 w-4" />
                  </span>
                  تصفية حسب الموقع
                </div>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1 self-start sm:self-auto"
                    onClick={clearFilters}
                  >
                    <X className="h-4 w-4" />
                    مسح الفلاتر
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={locationFilter === 'all' ? 'default' : 'outline'}
                  className={cn(
                    'rounded-full h-9 px-4 transition-all',
                    locationFilter === 'all' &&
                      'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 shadow-md border-0'
                  )}
                  onClick={() => setLocationFilter('all')}
                >
                  الكل
                </Button>
                {locationOptions.map((loc) => {
                  const active = locationFilter === loc.id
                  const label = loc.name_ar || loc.name
                  return (
                    <Button
                      key={loc.id}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      className={cn(
                        'rounded-full h-9 px-4 max-w-[220px] truncate transition-all',
                        active &&
                          'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 shadow-md border-0'
                      )}
                      title={label}
                      onClick={() => setLocationFilter(loc.id)}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto gap-2 rounded-xl border-orange-200/80 dark:border-orange-900/50 bg-background/80"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    فلاتر متقدمة
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', advancedOpen && 'rotate-180')}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4 data-[state=open]:animate-in data-[state=closed]:animate-out">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="pending-search" className="text-xs text-muted-foreground flex items-center gap-1">
                        <Search className="h-3.5 w-3.5" />
                        بحث
                      </Label>
                      <Input
                        id="pending-search"
                        dir="rtl"
                        placeholder="اسم الضيف، رقم الحجز، الهاتف…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">حالة الحجز</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="rounded-xl" dir="rtl">
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="all">الكل</SelectItem>
                          {Object.entries(RESERVATION_STATUSES).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border bg-background/60 p-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        تاريخ الدخول
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="check-in-from" className="text-[10px] text-muted-foreground">
                            من
                          </Label>
                          <Input
                            id="check-in-from"
                            type="date"
                            value={checkInFrom}
                            onChange={(e) => setCheckInFrom(e.target.value)}
                            className="rounded-lg h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="check-in-to" className="text-[10px] text-muted-foreground">
                            إلى
                          </Label>
                          <Input
                            id="check-in-to"
                            type="date"
                            value={checkInTo}
                            onChange={(e) => setCheckInTo(e.target.value)}
                            className="rounded-lg h-9 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/60 p-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        تاريخ الإنشاء
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="created-from" className="text-[10px] text-muted-foreground">
                            من
                          </Label>
                          <Input
                            id="created-from"
                            type="date"
                            value={createdFrom}
                            onChange={(e) => setCreatedFrom(e.target.value)}
                            className="rounded-lg h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="created-to" className="text-[10px] text-muted-foreground">
                            إلى
                          </Label>
                          <Input
                            id="created-to"
                            type="date"
                            value={createdTo}
                            onChange={(e) => setCreatedTo(e.target.value)}
                            className="rounded-lg h-9 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/60 p-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        تاريخ الخروج
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="check-out-from" className="text-[10px] text-muted-foreground">
                            من
                          </Label>
                          <Input
                            id="check-out-from"
                            type="date"
                            value={checkOutFrom}
                            onChange={(e) => setCheckOutFrom(e.target.value)}
                            className="rounded-lg h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="check-out-to" className="text-[10px] text-muted-foreground">
                            إلى
                          </Label>
                          <Input
                            id="check-out-to"
                            type="date"
                            value={checkOutTo}
                            onChange={(e) => setCheckOutTo(e.target.value)}
                            className="rounded-lg h-9 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {pageLoading && (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-72" />
                    </div>
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!pageLoading && totalFiltered === 0 && !hasActiveFilters && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{restrictedBranchManager ? 'لا توجد طلبات حجز' : 'لا توجد حجوزات معلقة'}</h3>
              <p className="text-muted-foreground">{restrictedBranchManager ? 'لم تقم بإرسال أي طلبات حجز بعد' : 'تم مراجعة جميع الحجوزات'}</p>
            </CardContent>
          </Card>
        )}

        {!pageLoading && totalFiltered === 0 && hasActiveFilters && (
            <Card className="border-dashed border-orange-200 dark:border-orange-900/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-3 opacity-60" />
                <h3 className="text-lg font-semibold mb-1">لا توجد نتائج للفلاتر الحالية</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  جرّب تغيير الموقع أو توسيع نطاق التواريخ، أو امسح الفلاتر لعرض كل الطلبات.
                </p>
                {hasActiveFilters && (
                  <Button type="button" variant="outline" onClick={clearFilters} className="gap-2 rounded-xl">
                    <X className="h-4 w-4" />
                    مسح الفلاتر
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

        {/* Reservation cards */}
        <div className="grid gap-4">
          {pendingRows.map((res, index) => {
            const isUnread = bookingNotifs?.some(n => n.reservation_id === res.id && !n.is_read)
            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`hover:shadow-lg transition-all duration-200 ${
                  isUnread ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20' : ''
                }`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={
                            res.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            res.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            res.status === 'checked_in' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }>
                            {res.status === 'confirmed' ? <CheckCircle className="h-3 w-3 ml-1" /> :
                             res.status === 'cancelled' ? <XCircle className="h-3 w-3 ml-1" /> :
                             <Clock className="h-3 w-3 ml-1" />}
                            {RESERVATION_STATUSES[res.status as keyof typeof RESERVATION_STATUSES] || res.status}
                          </Badge>
                          <span className="font-mono text-sm font-semibold text-muted-foreground">{res.reservation_number}</span>
                          {isUnread && (
                            <span className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate font-medium">{guestName(res.guest)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">
                              {res.unit?.unit_number} — {res.unit?.location?.name_ar || res.unit?.location?.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span>
                              {formatDateShort(res.check_in_date)} → {formatDateShort(res.check_out_date)}
                              <span className="text-muted-foreground mr-1">({daysBetween(res.check_in_date, res.check_out_date)} ليلة)</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-semibold">{formatCurrency(res.total_amount)}</span>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2">
                          بواسطة: {userEmailById.get(res.created_by) || res.created_by?.substring(0, 8) + '...'}
                          {' · '}
                          {formatDateShort(res.created_at)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetail(res)}
                        >
                          <Eye className="h-4 w-4 ml-1" />
                          التفاصيل
                        </Button>
                        {!restrictedBranchManager && res.status === 'pending' && (
                        <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleConfirm(res.id)}
                          disabled={updateReservation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 ml-1" />
                          تأكيد
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(res.id)}
                          disabled={updateReservation.isPending}
                        >
                          <XCircle className="h-4 w-4 ml-1" />
                          رفض
                        </Button>
                        </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {totalPages > 1 && !pageLoading && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border/60">
            <p className="text-sm text-muted-foreground text-center sm:text-start">
              صفحة {currentPage.toLocaleString('ar-EG')} من {totalPages.toLocaleString('ar-EG')}
              {' · '}
              عرض {pendingRows.length.toLocaleString('ar-EG')} من {totalFiltered.toLocaleString('ar-EG')}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="gap-1"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-orange-500" />
                تفاصيل الحجز — {selectedReservation?.reservation_number}
              </DialogTitle>
            </DialogHeader>
            {selectedReservation && (
              <div className="space-y-6">
                {/* Guest info */}
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" /> بيانات الضيف
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">الاسم:</span>
                      <span className="font-medium mr-2">{guestName(selectedReservation.guest)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الهاتف:</span>
                      <span className="font-medium mr-2 direction-ltr">{selectedReservation.guest.phone}</span>
                    </div>
                    {selectedReservation.guest.email && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">البريد:</span>
                        <span className="font-medium mr-2">{selectedReservation.guest.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Unit info */}
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Home className="h-4 w-4" /> بيانات الوحدة
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">الوحدة:</span>
                      <span className="font-medium mr-2">{selectedReservation.unit?.unit_number} — {selectedReservation.unit?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الموقع:</span>
                      <span className="font-medium mr-2">{selectedReservation.unit?.location?.name_ar || selectedReservation.unit?.location?.name}</span>
                    </div>
                  </div>
                </div>

                {/* Reservation details */}
                <div className="rounded-xl border p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> تفاصيل الحجز
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">تاريخ الدخول:</span>
                      <span className="font-medium mr-2">{formatDateShort(selectedReservation.check_in_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">تاريخ الخروج:</span>
                      <span className="font-medium mr-2">{formatDateShort(selectedReservation.check_out_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">عدد الليالي:</span>
                      <span className="font-medium mr-2">{daysBetween(selectedReservation.check_in_date, selectedReservation.check_out_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">البالغين / الأطفال:</span>
                      <span className="font-medium mr-2">{selectedReservation.adults} / {selectedReservation.children}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                      <span className="font-bold mr-2 text-green-600">{formatCurrency(selectedReservation.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المصدر:</span>
                      <span className="font-medium mr-2">{selectedReservation.source}</span>
                    </div>
                  </div>
                  {selectedReservation.notes && (
                    <div className="mt-2">
                      <span className="text-muted-foreground text-sm">ملاحظات:</span>
                      <p className="text-sm mt-1 bg-muted/50 rounded-lg p-3">{selectedReservation.notes}</p>
                    </div>
                  )}
                </div>

                {/* Creator info */}
                <div className="text-xs text-muted-foreground border-t pt-3">
                  تم الإنشاء بواسطة: {userEmailById.get(selectedReservation.created_by) || selectedReservation.created_by}
                  {' · '}
                  {formatDateShort(selectedReservation.created_at)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  {!restrictedBranchManager && selectedReservation.status === 'pending' && (
                    <>
                      <Button
                        className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => { handleConfirm(selectedReservation.id); setDetailOpen(false) }}
                        disabled={updateReservation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 ml-2" />
                        تأكيد الحجز
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 min-w-[140px]"
                        onClick={() => { handleReject(selectedReservation.id); setDetailOpen(false) }}
                        disabled={updateReservation.isPending}
                      >
                        <XCircle className="h-4 w-4 ml-2" />
                        رفض الحجز
                      </Button>
                    </>
                  )}
                  <Link href={`/reservations/${selectedReservation.id}`}>
                    <Button variant="outline" size="icon" className="rounded-xl">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  )
}
