'use client'

import { useState } from 'react'
import { useGuests, useDeleteGuest } from '@/lib/hooks/use-guests'
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
import { Plus, Search, Edit, Trash2, Download, Upload, Filter, LayoutGrid, List, Phone, Mail, User, Calendar, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { exportGuestsToCSV } from '@/lib/utils/export'
import { DataImport } from '@/components/import/DataImport'
import { DialogTrigger } from '@/components/ui/dialog'
import { AdvancedSearch, SearchFilters } from '@/components/search/AdvancedSearch'
import { toast } from '@/components/ui/use-toast'
import { formatDateShort } from '@/lib/utils'
import { motion } from 'framer-motion'

type ViewMode = 'cards' | 'table'

export default function GuestsPage() {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [advancedFilters, setAdvancedFilters] = useState<SearchFilters>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [guestToDelete, setGuestToDelete] = useState<{ id: string; name: string } | null>(null)
  const { data: guests, isLoading } = useGuests(search)
  const deleteGuest = useDeleteGuest()

  function handleAdvancedSearch(filters: SearchFilters) {
    setAdvancedFilters(filters)
    // Build search query from filters
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

  // Filter guests based on advanced filters
  const filteredGuests = guests?.filter((guest) => {
    if (advancedFilters.guestType && guest.guest_type !== advancedFilters.guestType) {
      return false
    }
    return true
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">الضيوف</h1>
          <p className="text-muted-foreground">إدارة جميع الضيوف</p>
        </div>
        <div className="flex gap-2">
          {guests && guests.length > 0 && (
            <Button
              variant="outline"
              onClick={() => exportGuestsToCSV(guests)}
            >
              <Download className="mr-2 h-4 w-4" />
              تصدير CSV
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
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
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              ضيف جديد
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن ضيف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
            </div>
            <div className="flex gap-2">
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
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-lg" />
              ))}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGuests?.map((guest, index) => (
                <motion.div
                  key={guest.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                    <div className="absolute inset-0 opacity-5">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
                    </div>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/20 to-transparent"
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                        repeatDelay: 2,
                      }}
                    />
                    <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50 pb-4">
                      <div className="flex items-start justify-between">
                  <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <motion.div
                              animate={{
                                rotate: [0, 360],
                              }}
                              transition={{
                                duration: 20,
                                repeat: Infinity,
                                ease: 'linear',
                              }}
                            >
                              <User className="h-5 w-5 text-blue-600" />
                            </motion.div>
                            <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      {guest.first_name_ar || guest.first_name} {guest.last_name_ar || guest.last_name}
                            </CardTitle>
                          </div>
                          {guest.military_rank_ar && (
                            <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              {guest.military_rank_ar}
                            </span>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          guest.guest_type === 'military' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                          guest.guest_type === 'club_member' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                          guest.guest_type === 'artillery_family' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                          'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300'
                        }`}>
                          {guest.guest_type === 'military' ? 'عسكري' :
                           guest.guest_type === 'club_member' ? 'عضو دار' :
                           guest.guest_type === 'artillery_family' ? 'ابناء مدفعية' : 'مدني'}
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
                          <Button variant="outline" className="w-full relative overflow-hidden group border-2 hover:border-blue-500 transition-all">
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/20 to-transparent"
                              animate={{
                                x: ['-100%', '100%'],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'linear',
                              }}
                            />
                            <Edit className="mr-2 h-4 w-4 relative z-10" />
                            <span className="relative z-10">تعديل</span>
                      </Button>
                    </Link>
                        <Button
                          variant="outline"
                          onClick={() => openDeleteDialog(guest.id, `${guest.first_name_ar || guest.first_name} ${guest.last_name_ar || guest.last_name}`)}
                          className="relative overflow-hidden group border-2 hover:border-red-500 transition-all text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={deleteGuest.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                  </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {filteredGuests?.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold text-muted-foreground">لا يوجد ضيوف</p>
                  <p className="text-sm text-muted-foreground mt-2">ابدأ بإضافة ضيف جديد</p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
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
                  {filteredGuests?.map((guest) => (
                    <TableRow key={guest.id}>
                      <TableCell className="font-medium">
                        {guest.first_name_ar || guest.first_name} {guest.last_name_ar || guest.last_name}
                      </TableCell>
                      <TableCell>{guest.phone}</TableCell>
                      <TableCell>{guest.email || '-'}</TableCell>
                      <TableCell>{guest.military_rank_ar || '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          guest.guest_type === 'military' ? 'bg-blue-100 text-blue-800' :
                          guest.guest_type === 'club_member' ? 'bg-purple-100 text-purple-800' :
                          guest.guest_type === 'artillery_family' ? 'bg-red-100 text-red-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {guest.guest_type === 'military' ? 'عسكري' :
                           guest.guest_type === 'club_member' ? 'عضو دار' :
                           guest.guest_type === 'artillery_family' ? 'ابناء مدفعية' : 'مدني'}
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
                            onClick={() => openDeleteDialog(guest.id, `${guest.first_name_ar || guest.first_name} ${guest.last_name_ar || guest.last_name}`)}
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
                  {filteredGuests?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا يوجد ضيوف
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
  )
}

