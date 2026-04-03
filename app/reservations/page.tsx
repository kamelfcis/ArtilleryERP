'use client'

import { useState, useMemo, useEffect } from 'react'
import { useReservations } from '@/lib/hooks/use-reservations'
import { useDeleteReservation } from '@/lib/hooks/use-reservations'
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
import { toast } from '@/components/ui/use-toast'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { exportReservationsToCSV } from '@/lib/utils/export'
import { ReservationStatus, Reservation } from '@/lib/types/database'
import { Search, Plus, Trash2, Eye, Download, CheckSquare, Square, LayoutGrid, Table2, Filter, X, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import Link from 'next/link'
import { BulkActions } from '@/components/reservations/BulkActions'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'

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

export default function ReservationsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [unitTypeFilter, setUnitTypeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Check if user is Staff-only (not admin/manager)
  const { hasRole } = useAuth()
  const { data: currentStaff } = useCurrentStaff()
  const isStaffOnly = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')
  const isBranchManager = hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any)
  
  // For Staff users, force their location; for admins, use selected location
  const effectiveLocationId = isStaffOnly && currentStaff?.location_id 
    ? currentStaff.location_id 
    : (locationFilter !== 'all' ? locationFilter : undefined)

  const { data: reservations, isLoading } = useReservations({
    locationId: effectiveLocationId,
    status: statusFilter !== 'all' ? statusFilter as ReservationStatus : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })
  const { data: locations } = useLocations()
  const deleteReservation = useDeleteReservation()
  const queryClient = useQueryClient()

  // Refetch reservations when page is mounted/entered to get latest data
  useEffect(() => {
    // Invalidate and refetch all reservations queries to get latest data from database
    queryClient.invalidateQueries({ queryKey: ['reservations'] })
    queryClient.refetchQueries({ queryKey: ['reservations'] })
  }, [queryClient]) // Run when component mounts

  const filteredReservations = useMemo(() => {
    if (!reservations) return []

    return reservations.filter(r => {
      // Search filter
      const matchesSearch = !search || 
        r.reservation_number.toLowerCase().includes(search.toLowerCase()) ||
        r.guest?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.guest?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.guest?.phone?.includes(search) ||
        r.guest?.email?.toLowerCase().includes(search.toLowerCase())

      // Location filter - skip for Staff users as it's already filtered at query level
      const matchesLocation = isStaffOnly || locationFilter === 'all' || r.unit?.location_id === locationFilter

      // Unit type filter
      const matchesUnitType = unitTypeFilter === 'all' || r.unit?.type === unitTypeFilter

      // Source filter
      const matchesSource = sourceFilter === 'all' || r.source === sourceFilter

      return matchesSearch && matchesLocation && matchesUnitType && matchesSource
    })
  }, [reservations, search, locationFilter, unitTypeFilter, sourceFilter])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, locationFilter, unitTypeFilter, dateFrom, dateTo, sourceFilter])

  // Pagination computed values
  const totalPages = Math.max(1, Math.ceil(filteredReservations.length / itemsPerPage))
  const paginatedReservations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredReservations.slice(start, start + itemsPerPage)
  }, [filteredReservations, currentPage, itemsPerPage])

  // Ensure currentPage stays valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  async function handleDelete(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الحجز؟')) return

    try {
      await deleteReservation.mutateAsync(id)
      toast({
        title: 'نجح',
        description: 'تم حذف الحجز بنجاح',
      })
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في حذف الحجز',
        variant: 'destructive',
      })
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
    setLocationFilter('all')
    setUnitTypeFilter('all')
    setDateFrom('')
    setDateTo('')
    setSourceFilter('all')
  }

  const hasActiveFilters = statusFilter !== 'all' || (!isStaffOnly && locationFilter !== 'all') || 
    unitTypeFilter !== 'all' || dateFrom || dateTo || sourceFilter !== 'all'

  function toggleSelectAll() {
    if (selectedIds.length === filteredReservations.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredReservations.map(r => r.id))
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent"
          >
            الحجوزات
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground flex items-center gap-2"
          >
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              📋
            </motion.span>
            إدارة جميع الحجوزات
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-2 flex-wrap"
        >
          {filteredReservations && filteredReservations.length > 0 && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                onClick={() => exportReservationsToCSV(filteredReservations)}
                className="relative overflow-hidden group border-2 hover:border-primary transition-all"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
                <Download className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">تصدير CSV</span>
              </Button>
            </motion.div>
          )}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href="/reservations/new">
              <Button className="relative overflow-hidden group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
                <Plus className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">حجز جديد</span>
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {selectedIds.length > 0 && (
        <BulkActions
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
        />
      )}

      {/* Filters Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="relative overflow-hidden border-2">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    placeholder="ابحث عن حجز (رقم، اسم، هاتف، بريد)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 relative z-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] relative z-10">
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
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant={showAdvancedFilters ? "default" : "outline"}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className="relative z-10"
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    فلاتر متقدمة
                    {hasActiveFilters && (
                      <Badge className="mr-2 bg-primary text-primary-foreground">
                        {[statusFilter !== 'all', locationFilter !== 'all', unitTypeFilter !== 'all', dateFrom, dateTo, sourceFilter !== 'all'].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
                    className="relative z-10"
                  >
                    {viewMode === 'table' ? (
                      <LayoutGrid className="h-4 w-4" />
                    ) : (
                      <Table2 className="h-4 w-4" />
                    )}
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Advanced Filters */}
            <AnimatePresence>
              {showAdvancedFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative z-10 mt-4 pt-4 border-t space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>الموقع</Label>
                      {!isStaffOnly ? (
                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="جميع المواقع" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">جميع المواقع</SelectItem>
                            {locations?.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name_ar}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <SelectItem value="room">غرفة</SelectItem>
                          <SelectItem value="suite">جناح</SelectItem>
                          <SelectItem value="chalet">شاليه</SelectItem>
                          <SelectItem value="duplex">دوبلكس</SelectItem>
                          <SelectItem value="villa">فيلا</SelectItem>
                          <SelectItem value="apartment">شقة</SelectItem>
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
                          <SelectItem value="online">أونلاين</SelectItem>
                          <SelectItem value="phone">هاتف</SelectItem>
                          <SelectItem value="walk_in">حضوري</SelectItem>
                          <SelectItem value="email">بريد إلكتروني</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>من تاريخ</Label>
                      <div className="relative">
                        <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="pr-10"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>إلى تاريخ</Label>
                      <div className="relative">
                        <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="pr-10"
                        />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={clearFilters}
                        className="w-full"
                      >
                        <X className="mr-2 h-4 w-4" />
                        مسح الفلاتر
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Results Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="relative overflow-hidden border-2">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardTitle className="relative z-10">
                النتائج ({filteredReservations.length})
              </CardTitle>
              {filteredReservations.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="relative z-10"
                >
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
              )}
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
              <div className="space-y-2">
                {paginatedReservations.map((reservation) => {
                  const isSelected = selectedIds.includes(reservation.id)
                  return (
                    <motion.div
                      key={reservation.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-all ${
                        isSelected ? 'bg-accent border-primary shadow-md' : ''
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (isSelected) {
                            setSelectedIds(selectedIds.filter(id => id !== reservation.id))
                          } else {
                            setSelectedIds([...selectedIds, reservation.id])
                          }
                        }}
                        className="flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                          <p className="font-semibold">{reservation.reservation_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {reservation.guest?.first_name} {reservation.guest?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {reservation.guest?.phone}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {reservation.unit?.unit_number} - {reservation.unit?.name_ar}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {unitTypeLabels[reservation.unit?.type || '']}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm">
                            {formatDateShort(reservation.check_in_date)} - {formatDateShort(reservation.check_out_date)}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {sourceLabels[reservation.source]}
                          </Badge>
                        </div>
                        <div>
                          <span className={`px-2 py-1 rounded text-xs ${statusColors[reservation.status]}`}>
                            {statusLabels[reservation.status]}
                          </span>
                          <p className="text-sm font-medium mt-1">
                            {formatCurrency(reservation.total_amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            مدفوع: {formatCurrency(reservation.paid_amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/reservations/${reservation.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {!isBranchManager && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(reservation.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
                {filteredReservations.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg">لا توجد حجوزات</p>
                    <p className="text-sm mt-2">جرب تغيير الفلاتر أو إضافة حجز جديد</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedReservations.map((reservation) => {
                  const isSelected = selectedIds.includes(reservation.id)
                  return (
                    <motion.div
                      key={reservation.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      className={`relative overflow-hidden border rounded-lg p-4 hover:shadow-lg transition-all ${
                        isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                      }`}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
                      <div className="relative">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-lg">{reservation.reservation_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {reservation.guest?.first_name} {reservation.guest?.last_name}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (isSelected) {
                                setSelectedIds(selectedIds.filter(id => id !== reservation.id))
                              } else {
                                setSelectedIds([...selectedIds, reservation.id])
                              }
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 text-primary" />
                            ) : (
                              <Square className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">الوحدة</span>
                            <span className="text-sm font-medium">
                              {reservation.unit?.unit_number} - {reservation.unit?.name_ar}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">نوع الوحدة</span>
                            <Badge variant="outline">
                              {unitTypeLabels[reservation.unit?.type || '']}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">التواريخ</span>
                            <span className="text-sm">
                              {formatDateShort(reservation.check_in_date)} - {formatDateShort(reservation.check_out_date)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">المصدر</span>
                            <Badge variant="outline">
                              {sourceLabels[reservation.source]}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">الحالة</span>
                            <span className={`px-2 py-1 rounded text-xs ${statusColors[reservation.status]}`}>
                              {statusLabels[reservation.status]}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-muted-foreground">المبلغ الإجمالي</span>
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(reservation.total_amount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">المدفوع</span>
                            <span className="text-sm font-medium">
                              {formatCurrency(reservation.paid_amount)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/reservations/${reservation.id}`} className="flex-1">
                            <Button variant="outline" className="w-full">
                              <Eye className="mr-2 h-4 w-4" />
                              عرض التفاصيل
                            </Button>
                          </Link>
                          {!isBranchManager && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDelete(reservation.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
                {filteredReservations.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <p className="text-lg">لا توجد حجوزات</p>
                    <p className="text-sm mt-2">جرب تغيير الفلاتر أو إضافة حجز جديد</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {/* Pagination Controls */}
          {filteredReservations.length > 0 && (
            <div className="relative border-t px-6 py-4 flex items-center justify-between flex-wrap gap-4">
              {/* Info text */}
              <div className="text-sm text-muted-foreground">
                عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredReservations.length)} من {filteredReservations.length} حجز
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="الصفحة الأولى"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                {(() => {
                  const pages: number[] = []
                  const maxVisible = 5
                  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                  let end = Math.min(totalPages, start + maxVisible - 1)
                  if (end - start + 1 < maxVisible) {
                    start = Math.max(1, end - maxVisible + 1)
                  }
                  for (let i = start; i <= end; i++) pages.push(i)

                  return (
                    <>
                      {start > 1 && (
                        <>
                          <Button
                            variant={1 === currentPage ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8 text-xs"
                            onClick={() => setCurrentPage(1)}
                          >
                            1
                          </Button>
                          {start > 2 && <span className="px-1 text-muted-foreground text-xs">...</span>}
                        </>
                      )}
                      {pages.map(page => (
                        <Button
                          key={page}
                          variant={page === currentPage ? 'default' : 'outline'}
                          size="icon"
                          className="h-8 w-8 text-xs"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                      {end < totalPages && (
                        <>
                          {end < totalPages - 1 && <span className="px-1 text-muted-foreground text-xs">...</span>}
                          <Button
                            variant={totalPages === currentPage ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8 text-xs"
                            onClick={() => setCurrentPage(totalPages)}
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </>
                  )
                })()}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="الصفحة الأخيرة"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
              </div>

              {/* Items per page selector */}
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
  )
}
