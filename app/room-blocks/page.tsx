'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit, Trash2, Calendar, LayoutGrid, List, Search, Filter, AlertTriangle, Home, X } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { useUnits } from '@/lib/hooks/use-units'
import { useLocations } from '@/lib/hooks/use-locations'
import { AdvancedSearch, SearchFilters } from '@/components/search/AdvancedSearch'
import { motion } from 'framer-motion'

type ViewMode = 'cards' | 'table'

export default function RoomBlocksPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [searchQuery, setSearchQuery] = useState('')
  const [advancedFilters, setAdvancedFilters] = useState<SearchFilters>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [blockToDelete, setBlockToDelete] = useState<{ id: string; name: string } | null>(null)
  const [formKey, setFormKey] = useState(0)
  const queryClient = useQueryClient()

  const { data: blocks, isLoading } = useQuery({
    queryKey: ['room-blocks'],
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
        .order('start_date', { ascending: false })

      if (error) throw error
      return data
    },
  })

  const deleteBlock = useMutation({
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
      setDeleteDialogOpen(false)
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

  function handleEdit(id: string) {
    setEditingBlock(id)
    setFormKey(prev => prev + 1)
    setDialogOpen(true)
  }

  function openDeleteDialog(id: string, name: string) {
    setBlockToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  function handleDelete() {
    if (!blockToDelete) return
    deleteBlock.mutate(blockToDelete.id)
  }

  function handleAdvancedSearch(filters: SearchFilters) {
    setAdvancedFilters(filters)
    if (filters.query) {
      setSearchQuery(filters.query)
    }
  }

  // Filter blocks based on search and filters
  const filteredBlocks = useMemo(() => {
    if (!blocks) return []
    
    return blocks.filter((block: any) => {
      // Text search
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase()
        const matchesSearch = 
          block.name_ar?.toLowerCase().includes(searchLower) ||
          block.name?.toLowerCase().includes(searchLower) ||
          block.reason_ar?.toLowerCase().includes(searchLower) ||
          block.reason?.toLowerCase().includes(searchLower)
        if (!matchesSearch) return false
      }

      // Date filters
      if (advancedFilters.dateFrom) {
        if (new Date(block.end_date) < new Date(advancedFilters.dateFrom)) return false
      }
      if (advancedFilters.dateTo) {
        if (new Date(block.start_date) > new Date(advancedFilters.dateTo)) return false
      }

      // Location filter
      if (advancedFilters.locationId) {
        const blockUnitIds = block.units?.map((u: any) => u.unit?.id) || []
        // This would require fetching units with locations, simplified for now
      }

      return true
    })
  }, [blocks, searchQuery, advancedFilters])

  return (
    <div className="p-6 space-y-6">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
            repeatDelay: 2,
          }}
        />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
            حظر الوحدات
          </h1>
          <p className="text-slate-300">إدارة حظر الوحدات للصيانة أو الأحداث</p>
        </div>
      </div>

      {/* Premium Search and Actions Bar */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 flex gap-2 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث في الحظورات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-white/80 dark:bg-slate-800/80 border-2 focus:border-blue-500"
                />
              </div>
              <AdvancedSearch onSearch={handleAdvancedSearch} type="reservations" />
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 rounded-lg p-1 border-2">
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className={viewMode === 'cards' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : ''}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className={viewMode === 'table' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : ''}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={() => {
                  setEditingBlock(null)
                  setFormKey(prev => prev + 1)
                  setDialogOpen(true)
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                حظر جديد
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Premium Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-0 shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredBlocks && filteredBlocks.length > 0 ? (
        viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlocks.map((block: any, index: number) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="relative border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 dark:from-slate-900 dark:via-slate-800/50 dark:to-blue-950/20 group">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/20 to-transparent" />
                  </div>
                  <CardHeader className="relative z-10 border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                          >
                            <Home className="h-5 w-5 text-blue-600" />
                          </motion.div>
                          <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            {block.name_ar || block.name}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span>{formatDateShort(block.start_date)} - {formatDateShort(block.end_date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(block.id)}
                        className="flex-1 border-2 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        تعديل
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(block.id, block.name_ar || block.name)}
                        className="border-2 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10 pt-6 space-y-4">
                    {block.reason_ar && (
                      <div className="p-3 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{block.reason_ar}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">الوحدات المحظورة:</p>
                      <div className="flex flex-wrap gap-2">
                        {block.units?.map((unitLink: any) => (
                          <motion.span
                            key={unitLink.unit.id}
                            whileHover={{ scale: 1.05 }}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-800"
                          >
                            {unitLink.unit.unit_number} - {unitLink.unit.name_ar || unitLink.unit.name}
                          </motion.span>
                        ))}
                        {(!block.units || block.units.length === 0) && (
                          <span className="text-xs text-muted-foreground">لا توجد وحدات</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-0">
              <div className="rounded-md border-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-800 dark:to-blue-950/20">
                      <TableHead className="font-bold">الاسم</TableHead>
                      <TableHead className="font-bold">تاريخ البداية</TableHead>
                      <TableHead className="font-bold">تاريخ النهاية</TableHead>
                      <TableHead className="font-bold">السبب</TableHead>
                      <TableHead className="font-bold">الوحدات</TableHead>
                      <TableHead className="font-bold text-left">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlocks.map((block: any) => (
                      <TableRow key={block.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-medium">{block.name_ar || block.name}</TableCell>
                        <TableCell>{formatDateShort(block.start_date)}</TableCell>
                        <TableCell>{formatDateShort(block.end_date)}</TableCell>
                        <TableCell className="max-w-xs truncate">{block.reason_ar || block.reason || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {block.units?.slice(0, 3).map((unitLink: any) => (
                              <span key={unitLink.unit.id} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs">
                                {unitLink.unit.unit_number}
                              </span>
                            ))}
                            {block.units && block.units.length > 3 && (
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs">
                                +{block.units.length - 3}
                              </span>
                            )}
                            {(!block.units || block.units.length === 0) && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(block.id)}
                              className="hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(block.id, block.name_ar || block.name)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="border-0 shadow-xl">
          <CardContent className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <Home className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">لا توجد حظورات</p>
            <p className="text-sm text-muted-foreground mt-2">ابدأ بإضافة حظر جديد</p>
          </CardContent>
        </Card>
      )}

      {/* Premium Delete Confirmation Dialog */}
      {deleteDialogOpen && (
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-gradient-to-br from-white via-red-50/50 to-orange-50/50 dark:from-slate-900 dark:via-red-950/20 dark:to-orange-950/20 backdrop-blur-xl">
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-2xl bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                تأكيد الحذف
              </DialogTitle>
            </div>
            <DialogDescription className="text-base">
              هل أنت متأكد من حذف الحظر <span className="font-semibold text-slate-900 dark:text-slate-100">{blockToDelete?.name}</span>؟
              <br />
              <span className="text-sm text-red-600 dark:text-red-400 mt-2 block">لا يمكن التراجع عن هذا الإجراء.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="relative z-10 gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-2"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteBlock.isPending}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg"
            >
              {deleteBlock.isPending ? 'جاري الحذف...' : 'حذف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Create/Edit Room Block Dialog */}
      {dialogOpen && (
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingBlock(null)
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {editingBlock ? 'تعديل الحظر' : 'حظر جديد'}
              </DialogTitle>
            </DialogHeader>
            <RoomBlockForm
              key={editingBlock || `new-${formKey}`}
              blockId={editingBlock || undefined}
              onSuccess={() => {
                setDialogOpen(false)
                setEditingBlock(null)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function RoomBlockForm({
  blockId,
  onSuccess,
}: {
  blockId?: string
  onSuccess?: () => void
}) {
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [reasonAr, setReasonAr] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const queryClient = useQueryClient()
  const { data: locations } = useLocations()
  const { data: units } = useUnits({
    locationId: selectedLocation !== 'all' ? selectedLocation : undefined,
  })

  const { data: existingBlock } = useQuery({
    queryKey: ['room-block', blockId],
    queryFn: async () => {
      if (!blockId) return null
      const { data, error } = await supabase
        .from('room_blocks')
        .select(`
          *,
          units:room_block_units (
            unit_id
          )
        `)
        .eq('id', blockId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!blockId,
  })

  // Load existing block data
  useEffect(() => {
    if (existingBlock) {
      setName(existingBlock.name || '')
      setNameAr(existingBlock.name_ar || '')
      setStartDate(existingBlock.start_date ? existingBlock.start_date.split('T')[0] : '')
      setEndDate(existingBlock.end_date ? existingBlock.end_date.split('T')[0] : '')
      setReason(existingBlock.reason || '')
      setReasonAr(existingBlock.reason_ar || '')
      if (existingBlock.units) {
        setSelectedUnits(existingBlock.units.map((u: any) => u.unit_id))
      }
    }
  }, [existingBlock])

  const saveBlock = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      if (blockId) {
        // Update existing block
        const { data, error } = await supabase
          .from('room_blocks')
          .update({
            name,
            name_ar: nameAr,
            start_date: startDate,
            end_date: endDate,
            reason,
            reason_ar: reasonAr,
          })
          .eq('id', blockId)
          .select()
          .single()

        if (error) throw error

        // Update units
        await supabase
          .from('room_block_units')
          .delete()
          .eq('block_id', blockId)

        if (selectedUnits.length > 0) {
          const unitLinks = selectedUnits.map(unitId => ({
            block_id: blockId,
            unit_id: unitId,
          }))
          const { error: linkError } = await supabase.from('room_block_units').insert(unitLinks)
          if (linkError) throw linkError
        }

        return data
      } else {
        // Create new block
        const { data, error } = await supabase
          .from('room_blocks')
          .insert({
            name,
            name_ar: nameAr,
            start_date: startDate,
            end_date: endDate,
            reason,
            reason_ar: reasonAr,
            created_by: userId,
          })
          .select()
          .single()

        if (error) throw error

        // Link units
        if (selectedUnits.length > 0) {
          const unitLinks = selectedUnits.map(unitId => ({
            block_id: data.id,
            unit_id: unitId,
          }))
          const { error: linkError } = await supabase.from('room_block_units').insert(unitLinks)
          if (linkError) throw linkError
        }

        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-blocks'] })
      toast({
        title: 'نجح',
        description: blockId ? 'تم تحديث الحظر بنجاح' : 'تم إنشاء الحظر بنجاح',
      })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ الحظر',
        variant: 'destructive',
      })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (selectedUnits.length === 0) {
          toast({
            title: 'خطأ',
            description: 'يجب اختيار وحدة واحدة على الأقل',
            variant: 'destructive',
          })
          return
        }
        saveBlock.mutate()
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">الاسم (إنجليزي) *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border-2 focus:border-blue-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name_ar">الاسم (عربي) *</Label>
          <Input
            id="name_ar"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            required
            className="border-2 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">تاريخ البداية *</Label>
          <Input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="border-2 focus:border-blue-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">تاريخ النهاية *</Label>
          <Input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            required
            className="border-2 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">الموقع</Label>
        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger className="border-2 focus:border-blue-500">
            <SelectValue placeholder="اختر الموقع" />
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
      </div>

      <div className="space-y-2">
        <Label>الوحدات المحظورة *</Label>
        <div className="border-2 rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-2">
            {units?.map(unit => (
              <div key={unit.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`unit-${unit.id}`}
                  checked={selectedUnits.includes(unit.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUnits([...selectedUnits, unit.id])
                    } else {
                      setSelectedUnits(selectedUnits.filter(id => id !== unit.id))
                    }
                  }}
                  className="rounded border-2 focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor={`unit-${unit.id}`} className="text-sm cursor-pointer">
                  {unit.unit_number} - {unit.name_ar || unit.name}
                </label>
              </div>
            ))}
            {(!units || units.length === 0) && (
              <p className="col-span-2 text-sm text-muted-foreground text-center py-4">
                لا توجد وحدات متاحة
              </p>
            )}
          </div>
        </div>
        {selectedUnits.length === 0 && (
          <p className="text-xs text-red-600">يجب اختيار وحدة واحدة على الأقل</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="reason">السبب (إنجليزي)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="border-2 focus:border-blue-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason_ar">السبب (عربي)</Label>
          <Textarea
            id="reason_ar"
            value={reasonAr}
            onChange={(e) => setReasonAr(e.target.value)}
            rows={3}
            className="border-2 focus:border-blue-500"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setName('')
            setNameAr('')
            setStartDate('')
            setEndDate('')
            setReason('')
            setReasonAr('')
            setSelectedLocation('all')
            setSelectedUnits([])
          }}
        >
          إعادة تعيين
        </Button>
        <Button type="submit" disabled={saveBlock.isPending} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
          {saveBlock.isPending ? 'جاري الحفظ...' : 'حفظ'}
        </Button>
      </DialogFooter>
    </form>
  )
}
