'use client'

import { useState, useMemo, useEffect } from 'react'
import { useReservations, useDeleteReservation } from '@/lib/hooks/use-reservations'
import { useLocations } from '@/lib/hooks/use-locations'
import { useCurrentStaff } from '@/lib/hooks/use-staff'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { exportReservationsFiltered } from '@/lib/utils/export'
import { ReservationStatus, Reservation } from '@/lib/types/database'
import {
  Search,
  Plus,
  Trash2,
  Eye,
  Download,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Phone,
  User,
  ClipboardList,
  CalendarDays,
} from 'lucide-react'
import Link from 'next/link'
import { BulkActions } from '@/components/reservations/BulkActions'
import { LocationMultiSelect } from '@/components/filters/LocationMultiSelect'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { isRocketScopedUser } from '@/lib/constants/rocket-hotel'
import {
  getRocketManagedLocationIdsFromEnv,
  isRocketManagedLocation,
} from '@/lib/constants/rocket-locations'

type ViewMode = 'table' | 'cards'

const unitTypeLabels: Record<string, string> = {
  room: 'غرفة',
  suite: 'جناح',
  chalet: 'شاليه',
  duplex: 'دوبلكس',
  villa: 'فيلا',
  apartment: 'شقة',
}

const sourceLabels: Record<string, string> = {
  online: 'أونلاين',
  phone: 'هاتف',
  walk_in: 'حضوري',
  email: 'بريد إلكتروني',
}

function guestDisplayName(guest?: Reservation['guest']) {
  if (!guest) return ''
  return `${guest.first_name_ar || guest.first_name} ${guest.last_name_ar || guest.last_name}`.trim()
}

export default function ReservationsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [unitTypeFilter, setUnitTypeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isExporting, setIsExporting] = useState(false)

  const { user, hasRole, elevatedOps } = useAuth()
  const { data: currentStaff } = useCurrentStaff()
  const isStaffOnly = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')
  const isViewerMode = hasRole('Viewer')
  const restrictedBranchManager =
    hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
  const isRocketUser = isRocketScopedUser(user?.email)
  const { data: locations } = useLocations()

  const locationOptions = useMemo(() => {
    let list = [...(locations || [])]
    if (isRocketUser) {
      const rocketIds = getRocketManagedLocationIdsFromEnv()
      if (rocketIds) {
        list = list.filter((l) => rocketIds.includes(l.id))
      } else {
        list = list.filter(isRocketManagedLocation)
      }
    }
    return list.sort((a, b) =>
      (a.name_ar || a.name || '').localeCompare(b.name_ar || b.name || '', 'ar')
    )
  }, [locations, isRocketUser])

  const rocketManagedLocationIds = useMemo(() => {
    if (!isRocketUser) return null as string[] | null
    return locationOptions.map((l) => l.id)
  }, [isRocketUser, locationOptions])

  useEffect(() => {
    if (!isRocketUser || locationIds.length === 0) return
    const valid = locationIds.filter((id) => locationOptions.some((l) => l.id === id))
    if (valid.length !== locationIds.length) {
      setLocationIds(valid)
    }
  }, [isRocketUser, locationIds, locationOptions])

  const effectiveLocationIds = useMemo(() => {
    if (isStaffOnly && currentStaff?.location_id) {
      return [currentStaff.location_id]
    }
    if (isRocketUser && rocketManagedLocationIds?.length) {
      if (locationIds.length === 0) {
        return rocketManagedLocationIds
      }
      return locationIds.filter((id) => rocketManagedLocationIds.includes(id))
    }
    return locationIds.length > 0 ? locationIds : undefined
  }, [isStaffOnly, currentStaff?.location_id, isRocketUser, rocketManagedLocationIds, locationIds])

  const { data: reservations, isLoading } = useReservations({
    locationIds: effectiveLocationIds,
    status: statusFilter !== 'all' ? statusFilter as ReservationStatus : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    fetchAll: true,
  })
  const deleteReservation = useDeleteReservation()
  const queryClient = useQueryClient()

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['reservations'] })
    queryClient.refetchQueries({ queryKey: ['reservations'] })
  }, [queryClient])

  const filteredReservations = useMemo(() => {
    if (!reservations) return []

    return reservations.filter(r => {
      const guestName = guestDisplayName(r.guest)
      const matchesSearch = !search ||
        r.reservation_number.toLowerCase().includes(search.toLowerCase()) ||
        guestName.toLowerCase().includes(search.toLowerCase()) ||
        r.guest?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.guest?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.guest?.first_name_ar?.toLowerCase().includes(search.toLowerCase()) ||
        r.guest?.last_name_ar?.toLowerCase().includes(search.toLowerCase()) ||
        r.guest?.phone?.includes(search) ||
        r.guest?.email?.toLowerCase().includes(search.toLowerCase())

      const matchesLocation = isStaffOnly ||
        (isRocketUser
          ? r.unit?.location_id != null &&
            rocketManagedLocationIds?.includes(r.unit.location_id) &&
            (locationIds.length === 0 || locationIds.includes(r.unit.location_id))
          : locationIds.length === 0 ||
            (r.unit?.location_id != null && locationIds.includes(r.unit.location_id)))
      const matchesUnitType = unitTypeFilter === 'all' || r.unit?.type === unitTypeFilter
      const matchesSource = sourceFilter === 'all' || r.source === sourceFilter

      return matchesSearch && matchesLocation && matchesUnitType && matchesSource
    })
  }, [reservations, search, locationIds, unitTypeFilter, sourceFilter, isStaffOnly, isRocketUser, rocketManagedLocationIds])

  const stats = useMemo(() => ({
    total: reservations?.length ?? 0,
    filtered: filteredReservations.length,
    confirmed: filteredReservations.filter(r => r.status === 'confirmed').length,
    pending: filteredReservations.filter(r => r.status === 'pending').length,
  }), [reservations, filteredReservations])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, locationIds, unitTypeFilter, dateFrom, dateTo, sourceFilter])

  const totalPages = Math.max(1, Math.ceil(filteredReservations.length / itemsPerPage))
  const paginatedReservations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredReservations.slice(start, start + itemsPerPage)
  }, [filteredReservations, currentPage, itemsPerPage])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  async function handleDelete(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الحجز؟')) return

    try {
      await deleteReservation.mutateAsync(id)
      toast({ title: 'نجح', description: 'تم حذف الحجز بنجاح' })
    } catch {
      toast({ title: 'خطأ', description: 'فشل في حذف الحجز', variant: 'destructive' })
    }
  }

  async function handleExportExcel() {
    setIsExporting(true)
    try {
      if (filteredReservations.length === 0) {
        toast({ title: 'تنبيه', description: 'لا توجد حجوزات للتصدير' })
        return
      }
      exportReservationsFiltered(filteredReservations, dateFrom || undefined, dateTo || undefined)
      toast({
        title: 'نجح',
        description: `تم تصدير ${filteredReservations.length} حجز`,
      })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تصدير الحجوزات',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    checked_in: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    checked_out: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    no_show: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  }

  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    checked_in: 'تم تسجيل الدخول',
    checked_out: 'تم تسجيل الخروج',
    cancelled: 'ملغي',
    no_show: 'لم يحضر',
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setLocationIds([])
    setUnitTypeFilter('all')
    setDateFrom('')
    setDateTo('')
    setSourceFilter('all')
  }

  const hasActiveFilters = statusFilter !== 'all' || (!isStaffOnly && locationIds.length > 0) ||
    unitTypeFilter !== 'all' || dateFrom || dateTo || sourceFilter !== 'all'

  function toggleSelectAll() {
    if (selectedIds.length === filteredReservations.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredReservations.map(r => r.id))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/20">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <motion.div
              className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 shadow-xl"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
            >
              <ClipboardList className="h-10 w-10 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                الحجوزات
              </h1>
              <p className="text-muted-foreground mt-1">إدارة جميع الحجوزات</p>
              {isRocketUser && (
                <Badge variant="secondary" className="mt-2 text-xs font-normal">
                  مواقع روكيت فقط
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isViewerMode && (
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={isExporting || filteredReservations.length === 0}
              className="relative overflow-hidden border-2 hover:border-emerald-400 transition-all"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              تصدير Excel
            </Button>
            )}
            {!isViewerMode && (
            <Link href="/reservations/new">
              <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" />
                حجز جديد
              </Button>
            </Link>
            )}
          </div>
        </motion.div>

        {!isViewerMode && selectedIds.length > 0 && (
          <BulkActions
            selectedIds={selectedIds}
            onClearSelection={() => setSelectedIds([])}
          />
        )}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الحجوزات</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-20 mt-1" />
                  ) : (
                    <p className="text-4xl font-bold text-indigo-600">{stats.total.toLocaleString('ar-EG')}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10">
                  <ClipboardList className="h-7 w-7 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">نتائج الفلتر</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-20 mt-1" />
                  ) : (
                    <p className="text-4xl font-bold text-purple-600">{stats.filtered.toLocaleString('ar-EG')}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10">
                  <Filter className="h-7 w-7 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">مؤكدة</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16 mt-1" />
                  ) : (
                    <p className="text-4xl font-bold text-green-600">{stats.confirmed.toLocaleString('ar-EG')}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <CheckSquare className="h-7 w-7 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">قيد الانتظار</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16 mt-1" />
                  ) : (
                    <p className="text-4xl font-bold text-amber-600">{stats.pending.toLocaleString('ar-EG')}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <CalendarDays className="h-7 w-7 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="relative overflow-hidden border-2">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-blue-500/5 opacity-50" />
            <CardHeader className="relative space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ابحث عن حجز (رقم، اسم، هاتف، بريد)..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="حالة الحجز" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                      <SelectItem value="confirmed">مؤكد</SelectItem>
                      <SelectItem value="checked_in">تم تسجيل الدخول</SelectItem>
                      <SelectItem value="checked_out">تم تسجيل الخروج</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                      <SelectItem value="no_show">لم يحضر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showAdvancedFilters ? 'default' : 'outline'}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    فلاتر متقدمة
                    {hasActiveFilters && (
                      <Badge className="mr-2 bg-primary text-primary-foreground">
                        {[statusFilter !== 'all', !isStaffOnly && locationIds.length > 0, unitTypeFilter !== 'all', dateFrom, dateTo, sourceFilter !== 'all'].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-r-none"
                      onClick={() => setViewMode('table')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-l-none"
                      onClick={() => setViewMode('cards')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {showAdvancedFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="pt-4 border-t space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                      <div className="space-y-2">
                        <Label>الموقع</Label>
                        {!isStaffOnly ? (
                          <LocationMultiSelect
                            locations={locationOptions}
                            selectedIds={locationIds}
                            onChange={setLocationIds}
                          />
                        ) : (
                          <div className="px-3 py-2 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md border border-blue-300 dark:border-blue-700 flex items-center gap-2 text-sm font-medium">
                            {currentStaff?.location?.name_ar || currentStaff?.location?.name || 'موقعي'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>نوع الوحدة</Label>
                        <Select value={unitTypeFilter} onValueChange={setUnitTypeFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="جميع الأنواع" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">جميع الأنواع</SelectItem>
                            {Object.entries(unitTypeLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>المصدر</Label>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="جميع المصادر" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">جميع المصادر</SelectItem>
                            {Object.entries(sourceLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>من تاريخ</Label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>إلى تاريخ</Label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          min={dateFrom || undefined}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="invisible">إجراءات</Label>
                        <Button variant="outline" onClick={clearFilters} className="w-full">
                          <X className="mr-2 h-4 w-4" />
                          مسح الفلاتر
                        </Button>
                      </div>
                    </div>
                    {(dateFrom || dateTo) && (
                      <p className="text-xs text-muted-foreground">
                        التصدير سيشمل الحجوزات من {dateFrom || 'البداية'} إلى {dateTo || 'النهاية'}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="relative overflow-hidden border-2">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-blue-500/5 opacity-50" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>
                  النتائج ({filteredReservations.length.toLocaleString('ar-EG')})
                </CardTitle>
                <div className="flex items-center gap-2">
                  {filteredReservations.length > 0 && !isViewerMode && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportExcel}
                        disabled={isExporting}
                        className="border-emerald-200 hover:border-emerald-400 text-emerald-700"
                      >
                        {isExporting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        تصدير Excel
                      </Button>
                      <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                        {selectedIds.length === filteredReservations.length ? (
                          <>
                            <CheckSquare className="mr-2 h-4 w-4" />
                            إلغاء تحديد الكل
                          </>
                        ) : (
                          <>
                            <Square className="mr-2 h-4 w-4" />
                            تحديد الكل
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : viewMode === 'table' ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10">{!isViewerMode ? '' : null}</TableHead>
                        <TableHead>الضيف</TableHead>
                        <TableHead>الوحدة</TableHead>
                        <TableHead>التواريخ</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead className="text-left">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReservations.map((reservation) => {
                        const isSelected = selectedIds.includes(reservation.id)
                        const name = guestDisplayName(reservation.guest) || '—'
                        return (
                          <TableRow
                            key={reservation.id}
                            className={`transition-colors hover:bg-accent/50 ${isSelected ? 'bg-accent/70' : ''}`}
                          >
                            <TableCell className="w-10">
                              {!isViewerMode && (
                              <button
                                onClick={() => {
                                  setSelectedIds(isSelected
                                    ? selectedIds.filter(id => id !== reservation.id)
                                    : [...selectedIds, reservation.id])
                                }}
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-primary" />
                                ) : (
                                  <Square className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                                  <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                                    {name}
                                  </span>
                                </div>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {reservation.reservation_number}
                                </Badge>
                                {reservation.guest?.phone && (
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    {reservation.guest.phone}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">
                                {reservation.unit?.unit_number} — {reservation.unit?.name_ar}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {unitTypeLabels[reservation.unit?.type || '']}
                                {reservation.unit?.location?.name_ar && ` · ${reservation.unit.location.name_ar}`}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">
                                {formatDateShort(reservation.check_in_date)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                → {formatDateShort(reservation.check_out_date)}
                              </p>
                              <Badge variant="outline" className="mt-1 text-xs">
                                {sourceLabels[reservation.source]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[reservation.status]}`}>
                                {statusLabels[reservation.status]}
                              </span>
                            </TableCell>
                            <TableCell>
                              <p className="font-bold text-primary">{formatCurrency(reservation.total_amount)}</p>
                              <p className="text-xs text-muted-foreground">
                                مدفوع: {formatCurrency(reservation.paid_amount)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Link href={`/reservations/${reservation.id}`}>
                                  <Button variant="ghost" size="sm" title="عرض">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                                {!restrictedBranchManager && !isViewerMode && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(reservation.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="حذف"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  {filteredReservations.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="text-lg font-semibold">لا توجد حجوزات</p>
                      <p className="text-sm mt-2">جرب تغيير الفلاتر أو إضافة حجز جديد</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedReservations.map((reservation, index) => {
                    const isSelected = selectedIds.includes(reservation.id)
                    const name = guestDisplayName(reservation.guest) || '—'
                    return (
                      <motion.div
                        key={reservation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                        whileHover={{ scale: 1.02, y: -4 }}
                      >
                        <Card className={`relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 dark:from-indigo-950/30 dark:via-blue-950/30 dark:to-cyan-950/30 hover:shadow-2xl transition-all duration-300 ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full" />
                          <CardHeader className="relative z-10 border-b border-indigo-200/50 dark:border-indigo-800/50 pb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent truncate">
                                    {name}
                                  </CardTitle>
                                </div>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {reservation.reservation_number}
                                </Badge>
                                {reservation.guest?.phone && (
                                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                    <Phone className="h-4 w-4 text-indigo-500" />
                                    {reservation.guest.phone}
                                  </div>
                                )}
                              </div>
                              {!isViewerMode && (
                              <button
                                onClick={() => {
                                  setSelectedIds(isSelected
                                    ? selectedIds.filter(id => id !== reservation.id)
                                    : [...selectedIds, reservation.id])
                                }}
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-primary" />
                                ) : (
                                  <Square className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="relative z-10 pt-4 space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-indigo-200/50 dark:border-indigo-800/50">
                                <span className="text-sm text-muted-foreground">الوحدة</span>
                                <span className="text-sm font-medium">
                                  {reservation.unit?.unit_number} — {reservation.unit?.name_ar}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-indigo-200/50 dark:border-indigo-800/50">
                                <span className="text-sm text-muted-foreground">التواريخ</span>
                                <span className="text-sm font-medium">
                                  {formatDateShort(reservation.check_in_date)} — {formatDateShort(reservation.check_out_date)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[reservation.status]}`}>
                                  {statusLabels[reservation.status]}
                                </span>
                                <Badge variant="outline">{sourceLabels[reservation.source]}</Badge>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-indigo-200/50">
                                <span className="text-sm text-muted-foreground">المبلغ الإجمالي</span>
                                <span className="text-lg font-bold text-primary">
                                  {formatCurrency(reservation.total_amount)}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Link href={`/reservations/${reservation.id}`} className="flex-1">
                                <Button variant="outline" className="w-full border-2 hover:border-indigo-500">
                                  <Eye className="mr-2 h-4 w-4" />
                                  عرض التفاصيل
                                </Button>
                              </Link>
                              {!restrictedBranchManager && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDelete(reservation.id)}
                                  className="border-2 hover:border-red-500 text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                  {filteredReservations.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="text-lg font-semibold">لا توجد حجوزات</p>
                      <p className="text-sm mt-2">جرب تغيير الفلاتر أو إضافة حجز جديد</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            {filteredReservations.length > 0 && (
              <div className="relative border-t px-6 py-4 flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-muted-foreground">
                  عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredReservations.length)} من {filteredReservations.length.toLocaleString('ar-EG')} حجز
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="الصفحة الأولى">
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} title="الصفحة السابقة">
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  {(() => {
                    const pages: number[] = []
                    const maxVisible = 5
                    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                    let end = Math.min(totalPages, start + maxVisible - 1)
                    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
                    for (let i = start; i <= end; i++) pages.push(i)

                    return (
                      <>
                        {start > 1 && (
                          <>
                            <Button variant={1 === currentPage ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" onClick={() => setCurrentPage(1)}>1</Button>
                            {start > 2 && <span className="px-1 text-muted-foreground text-xs">...</span>}
                          </>
                        )}
                        {pages.map(page => (
                          <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" onClick={() => setCurrentPage(page)}>
                            {page}
                          </Button>
                        ))}
                        {end < totalPages && (
                          <>
                            {end < totalPages - 1 && <span className="px-1 text-muted-foreground text-xs">...</span>}
                            <Button variant={totalPages === currentPage ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" onClick={() => setCurrentPage(totalPages)}>{totalPages}</Button>
                          </>
                        )}
                      </>
                    )
                  })()}

                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} title="الصفحة التالية">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="الصفحة الأخيرة">
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">عدد لكل صفحة:</span>
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={(val) => {
                      setItemsPerPage(Number(val))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
