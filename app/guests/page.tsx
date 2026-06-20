'use client'

import { useState, useEffect } from 'react'
import {
  useGuestsPaginated,
  useGuestsTotalCount,
  useDeleteGuest,
  guestDisplayName,
  fetchAllGuests,
} from '@/lib/hooks/use-guests'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Upload,
  LayoutGrid,
  List,
  Phone,
  Mail,
  User,
  Calendar,
  AlertTriangle,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { exportGuestsToCSV } from '@/lib/utils/export'
import { DataImport } from '@/components/import/DataImport'
import { DialogTrigger } from '@/components/ui/dialog'
import { AdvancedSearch, SearchFilters } from '@/components/search/AdvancedSearch'
import { toast } from '@/components/ui/use-toast'
import { formatDateShort } from '@/lib/utils'
import { motion } from 'framer-motion'

type ViewMode = 'cards' | 'table'

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const

const guestTypeLabels: Record<string, string> = {
  military: 'عسكري',
  club_member: 'عضو دار',
  artillery_family: 'ابناء مدفعية',
  civilian: 'مدني',
}

const guestTypeStyles: Record<string, string> = {
  military: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  club_member: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  artillery_family: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  civilian: 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300',
}

export default function GuestsPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [advancedFilters, setAdvancedFilters] = useState<SearchFilters>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [guestToDelete, setGuestToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const deleteGuest = useDeleteGuest()
  const { data: totalCount = 0, isLoading: totalCountLoading } = useGuestsTotalCount()
  const { data: paginatedResult, isLoading, isFetching } = useGuestsPaginated({
    search: debouncedSearch,
    page: currentPage,
    pageSize,
    guestType: advancedFilters.guestType,
  })

  const guests = paginatedResult?.data ?? []
  const filteredTotal = paginatedResult?.totalCount ?? 0
  const totalPages = paginatedResult?.totalPages ?? 1
  const hasActiveFilters = Boolean(debouncedSearch || advancedFilters.guestType)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, advancedFilters.guestType, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  function handleAdvancedSearch(filters: SearchFilters) {
    setAdvancedFilters(filters)
    const searchTerms: string[] = []
    if (filters.query) searchTerms.push(filters.query)
    setSearch(searchTerms.join(' '))
  }

  function openDeleteDialog(id: string, name: string) {
    setGuestToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  function handleDeleteGuest() {
    if (!guestToDelete) return

    deleteGuest.mutate(guestToDelete.id, {
      onSuccess: () => {
        toast({
          title: 'نجح',
          description: 'تم حذف الضيف بنجاح',
        })
        setDeleteDialogOpen(false)
        setGuestToDelete(null)
      },
      onError: (error: any) => {
        toast({
          title: 'خطأ',
          description: error.message || 'فشل في حذف الضيف',
          variant: 'destructive',
        })
      },
    })
  }

  async function handleExportCSV() {
    setIsExporting(true)
    try {
      const allGuests = await fetchAllGuests({
        search: debouncedSearch,
        guestType: advancedFilters.guestType,
      })
      if (allGuests.length === 0) {
        toast({
          title: 'تنبيه',
          description: 'لا يوجد ضيوف للتصدير',
        })
        return
      }
      exportGuestsToCSV(allGuests)
      toast({
        title: 'نجح',
        description: `تم تصدير ${allGuests.length} ضيف`,
      })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تصدير الضيوف',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const rangeStart = filteredTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, filteredTotal)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/20">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Premium Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <motion.div
              className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 shadow-xl"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
            >
              <Users className="h-10 w-10 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                الضيوف
              </h1>
              <p className="text-muted-foreground mt-1">إدارة جميع الضيوف</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isExporting || filteredTotal === 0}
              className="border-2 hover:border-blue-400 transition-all"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              تصدير CSV
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-2 hover:border-indigo-400 transition-all">
                  <Upload className="mr-2 h-4 w-4" />
                  استيراد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>استيراد الضيوف</DialogTitle>
                </DialogHeader>
                <DataImport type="guests" />
              </DialogContent>
            </Dialog>
            <Link href="/guests/new">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" />
                ضيف جديد
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الضيوف</p>
                  {totalCountLoading ? (
                    <Skeleton className="h-9 w-20 mt-1" />
                  ) : (
                    <p className="text-4xl font-bold text-blue-600">{totalCount.toLocaleString('ar-EG')}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Users className="h-7 w-7 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {hasActiveFilters && (
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">نتائج البحث</p>
                    {isLoading ? (
                      <Skeleton className="h-9 w-20 mt-1" />
                    ) : (
                      <p className="text-4xl font-bold text-purple-600">{filteredTotal.toLocaleString('ar-EG')}</p>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/10">
                    <Search className="h-7 w-7 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">الصفحة الحالية</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-28 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-indigo-600">
                      {filteredTotal === 0 ? '—' : `${currentPage} / ${totalPages}`}
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10">
                  <User className="h-7 w-7 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="relative overflow-hidden border-2">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 opacity-50" />
            <CardHeader className="relative">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث عن ضيف (اسم، هاتف، بريد، هوية)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <AdvancedSearch onSearch={handleAdvancedSearch} type="guests" />
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-r-none"
                      onClick={() => setViewMode('cards')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-l-none"
                      onClick={() => setViewMode('table')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full rounded-lg" />
                  ))}
                </div>
              ) : viewMode === 'cards' ? (
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isFetching ? 'opacity-70' : ''}`}>
                  {guests.map((guest, index) => (
                    <motion.div
                      key={guest.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      whileHover={{ scale: 1.02, y: -4 }}
                    >
                      <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                        <div className="absolute inset-0 opacity-5">
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
                        </div>
                        <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50 pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <User className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                  {guestDisplayName(guest)}
                                </CardTitle>
                              </div>
                              {guest.military_rank_ar && (
                                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  {guest.military_rank_ar}
                                </span>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${guestTypeStyles[guest.guest_type] ?? guestTypeStyles.civilian}`}>
                              {guestTypeLabels[guest.guest_type] ?? guest.guest_type}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-6 space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50">
                              <Phone className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{guest.phone}</span>
                            </div>
                            {guest.email && (
                              <div className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50">
                                <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{guest.email}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/50">
                              <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <span className="text-xs text-muted-foreground">{formatDateShort(guest.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                            <Link href={`/guests/${guest.id}`} className="flex-1">
                              <Button variant="outline" className="w-full border-2 hover:border-blue-500 transition-all">
                                <Edit className="mr-2 h-4 w-4" />
                                تعديل
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              onClick={() => openDeleteDialog(guest.id, guestDisplayName(guest))}
                              className="border-2 hover:border-red-500 transition-all text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={deleteGuest.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                  {guests.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-lg font-semibold text-muted-foreground">لا يوجد ضيوف</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {hasActiveFilters ? 'جرب تغيير معايير البحث' : 'ابدأ بإضافة ضيف جديد'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`rounded-md border ${isFetching ? 'opacity-70' : ''}`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>رقم الهاتف</TableHead>
                        <TableHead>البريد الإلكتروني</TableHead>
                        <TableHead>الرتبة العسكرية</TableHead>
                        <TableHead>نوع الضيف</TableHead>
                        <TableHead>تاريخ الإضافة</TableHead>
                        <TableHead className="text-left">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guests.map((guest) => (
                        <TableRow key={guest.id}>
                          <TableCell className="font-medium">{guestDisplayName(guest)}</TableCell>
                          <TableCell>{guest.phone}</TableCell>
                          <TableCell>{guest.email || '-'}</TableCell>
                          <TableCell>{guest.military_rank_ar || '-'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${guestTypeStyles[guest.guest_type] ?? guestTypeStyles.civilian}`}>
                              {guestTypeLabels[guest.guest_type] ?? guest.guest_type}
                            </span>
                          </TableCell>
                          <TableCell>{formatDateShort(guest.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Link href={`/guests/${guest.id}`}>
                                <Button variant="ghost" size="sm" title="تعديل">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(guest.id, guestDisplayName(guest))}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="حذف"
                                disabled={deleteGuest.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {guests.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            {hasActiveFilters ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد ضيوف'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Pagination Controls */}
            {filteredTotal > 0 && (
              <div className="relative border-t px-6 py-4 flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-muted-foreground">
                  عرض {rangeStart.toLocaleString('ar-EG')} - {rangeEnd.toLocaleString('ar-EG')} من {filteredTotal.toLocaleString('ar-EG')} ضيف
                  {hasActiveFilters && totalCount > filteredTotal && (
                    <span className="mr-2 text-purple-600">(من إجمالي {totalCount.toLocaleString('ar-EG')})</span>
                  )}
                </div>

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
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    title="السابق"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  <span className="px-3 text-sm font-medium whitespace-nowrap">
                    صفحة {currentPage} من {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    title="التالي"
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

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">عدد لكل صفحة:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => setPageSize(Number(val))}
                  >
                    <SelectTrigger className="w-[80px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Delete Confirmation Dialog */}
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
              <DialogDescription className="text-center text-base mt-4 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  هل أنت متأكد من حذف الضيف؟
                </p>
                {guestToDelete && (
                  <p className="text-lg font-bold text-red-600 dark:text-red-400 py-2 px-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    {guestToDelete.name}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  لا يمكن التراجع عن هذا الإجراء. سيتم حذف جميع البيانات المرتبطة بهذا الضيف بشكل دائم.
                </p>
              </DialogDescription>
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
                onClick={handleDeleteGuest}
                disabled={deleteGuest.isPending}
              >
                {deleteGuest.isPending ? 'جاري الحذف...' : 'حذف نهائي'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
