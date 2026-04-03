'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useUnits } from '@/lib/hooks/use-units'
import { useLocations } from '@/lib/hooks/use-locations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, User, Shield, Users, Flame, DollarSign, Check, CheckCheck, X, MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Pricing } from '@/lib/types/database'
import { motion } from 'framer-motion'

interface PricingWithUnit extends Pricing {
  unit?: {
    id: string
    unit_number: string
    name?: string
    name_ar?: string
  }
  price_civilian?: number
  price_military?: number
  price_member?: number
  price_artillery_family?: number
}

export default function PricingPage() {
  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const { data: units } = useUnits()
  const queryClient = useQueryClient()

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['pricing', selectedUnit],
    queryFn: async () => {
      let query = supabase
        .from('pricing')
        .select(`
          *,
          unit:units (
            id,
            unit_number,
            name,
            name_ar
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit)
      }

      const { data, error } = await query
      if (error) throw error
      return data as PricingWithUnit[]
    },
  })

  const deletePrice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pricing')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      toast({
        title: 'نجح',
        description: 'تم حذف السعر بنجاح',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف السعر',
        variant: 'destructive',
      })
    },
  })

  function handleEdit(id: string) {
    setEditingPrice(id)
    setDialogOpen(true)
  }

  function handleDelete(id: string) {
    if (confirm('هل أنت متأكد من حذف هذا السعر؟')) {
      deletePrice.mutate(id)
    }
  }

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
        <div className="relative z-10 flex items-center gap-4">
          <motion.div
            className="p-4 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
          >
            <DollarSign className="h-10 w-10 text-white" />
          </motion.div>
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
              الأسعار
            </h1>
            <p className="text-slate-300">إدارة أسعار الوحدات حسب نوع الضيف (عسكري • مدني • عضو دار • أبناء مدفعية)</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20">
          <CardHeader>
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-[250px] border-2">
                <SelectValue placeholder="فلترة حسب الوحدة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الوحدات</SelectItem>
                {units?.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.unit_number} - {unit.name_ar || unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
        </Card>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingPrice(null)
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPrice(null)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              سعر جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {editingPrice ? 'تعديل السعر' : 'سعر جديد'}
              </DialogTitle>
            </DialogHeader>
            <PricingForm
              priceId={editingPrice || undefined}
              onSuccess={() => {
                setDialogOpen(false)
                setEditingPrice(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-xl">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : pricing && pricing.length > 0 ? (
            <div className="space-y-4">
              {pricing.map((price, index) => (
                <motion.div
                  key={price.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 dark:from-slate-900 dark:via-slate-800/50 dark:to-blue-950/20">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            {price.unit?.unit_number} - {price.unit?.name_ar || price.unit?.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {price.pricing_type === 'standard' ? 'قياسي' :
                             price.pricing_type === 'seasonal' ? 'موسمي' :
                             price.pricing_type === 'weekend' ? 'عطلة نهاية الأسبوع' :
                             price.pricing_type === 'holiday' ? 'عطلة' :
                             price.pricing_type === 'group' ? 'مجموعة' : price.pricing_type}
                            {price.start_date && price.end_date
                              ? ` • ${price.start_date} - ${price.end_date}`
                              : ' • دائم'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(price.id)}
                            className="border-2 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            تعديل
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(price.id)}
                            className="border-2 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* عسكري - Military */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-2 border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <Label className="text-sm font-semibold text-green-900 dark:text-green-200">عسكري</Label>
                          </div>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {formatCurrency(price.price_military || price.price_per_night || 0)}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">/ ليلة</p>
                        </div>

                        {/* مدني - Civilian */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <Label className="text-sm font-semibold text-blue-900 dark:text-blue-200">مدني</Label>
                          </div>
                          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {formatCurrency(price.price_civilian || price.price_per_night || 0)}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">/ ليلة</p>
                        </div>

                        {/* عضو دار - Club Member */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-2 border-purple-200 dark:border-purple-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            <Label className="text-sm font-semibold text-purple-900 dark:text-purple-200">عضو دار</Label>
                          </div>
                          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                            {formatCurrency(price.price_member || price.price_per_night || 0)}
                          </p>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">/ ليلة</p>
                        </div>

                        {/* أبناء مدفعية - Artillery Family */}
                        <div className="p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-2 border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Flame className="h-5 w-5 text-red-600 dark:text-red-400" />
                            <Label className="text-sm font-semibold text-red-900 dark:text-red-200">أبناء مدفعية</Label>
                          </div>
                          <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                            {formatCurrency(price.price_artillery_family || price.price_per_night || 0)}
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">/ ليلة</p>
                        </div>
                      </div>
                      {price.min_nights > 1 && (
                        <div className="mt-4 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-semibold">الحد الأدنى:</span> {price.min_nights} ليالي
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <DollarSign className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">لا توجد أسعار</p>
              <p className="text-sm text-muted-foreground mt-2">ابدأ بإضافة سعر جديد</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PricingForm({
  priceId,
  onSuccess,
}: {
  priceId?: string
  onSuccess?: () => void
}) {
  const { data: units } = useUnits()
  const { data: locations } = useLocations()
  const queryClient = useQueryClient()
  const isEditing = !!priceId

  // Location filter for unit list
  const [selectedLocation, setSelectedLocation] = useState<string>('')

  // Multi-unit selection (used for both add and edit)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [pricingType, setPricingType] = useState('standard')
  const [priceMilitary, setPriceMilitary] = useState('')
  const [priceCivilian, setPriceCivilian] = useState('')
  const [priceMember, setPriceMember] = useState('')
  const [priceArtilleryFamily, setPriceArtilleryFamily] = useState('')
  const [minNights, setMinNights] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [unitSearch, setUnitSearch] = useState('')

  // Load existing price data
  const { data: existingPrice } = useQuery({
    queryKey: ['pricing', priceId],
    queryFn: async () => {
      if (!priceId) return null
      const { data, error } = await supabase
        .from('pricing')
        .select('*')
        .eq('id', priceId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!priceId,
  })

  // Populate form when editing
  useEffect(() => {
    if (existingPrice) {
      setSelectedUnitIds(existingPrice.unit_id ? [existingPrice.unit_id] : [])
      setPricingType(existingPrice.pricing_type || 'standard')
      setPriceMilitary(existingPrice.price_military?.toString() || '')
      setPriceCivilian(existingPrice.price_civilian?.toString() || '')
      setPriceMember(existingPrice.price_member?.toString() || '')
      setPriceArtilleryFamily(existingPrice.price_artillery_family?.toString() || '')
      setMinNights(existingPrice.min_nights?.toString() || '1')
      setStartDate(existingPrice.start_date || '')
      setEndDate(existingPrice.end_date || '')
      // Pre-select location from the unit being edited
      const editUnit = units?.find(u => u.id === existingPrice.unit_id)
      if (editUnit) setSelectedLocation(editUnit.location_id)
    }
  }, [existingPrice, units])

  // Unit type labels for display
  const unitTypeLabels: Record<string, string> = {
    room: 'غرفة',
    suite: 'سويت',
    chalet: 'شاليه',
    duplex: 'دوبلكس',
    villa: 'فيلا',
    apartment: 'شقة',
  }

  // Filter units based on location and search
  const filteredUnits = units?.filter(u => {
    if (selectedLocation && u.location_id !== selectedLocation) return false
    if (!unitSearch) return true
    const searchLower = unitSearch.toLowerCase()
    return (
      u.unit_number.toLowerCase().includes(searchLower) ||
      (u.name_ar || '').toLowerCase().includes(searchLower) ||
      (u.name || '').toLowerCase().includes(searchLower) ||
      (unitTypeLabels[u.type] || '').includes(unitSearch)
    )
  })

  function toggleUnit(id: string) {
    setSelectedUnitIds(prev =>
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    )
  }

  function selectAllUnits() {
    if (filteredUnits) {
      setSelectedUnitIds(filteredUnits.map(u => u.id))
    }
  }

  function deselectAllUnits() {
    setSelectedUnitIds([])
  }

  const savePrice = useMutation({
    mutationFn: async () => {
      const basePriceData: any = {
        pricing_type: pricingType,
        price_military: parseFloat(priceMilitary) || null,
        price_civilian: parseFloat(priceCivilian) || null,
        price_member: parseFloat(priceMember) || null,
        price_artillery_family: parseFloat(priceArtilleryFamily) || null,
        price_per_night: parseFloat(priceMilitary) || parseFloat(priceCivilian) || parseFloat(priceMember) || parseFloat(priceArtilleryFamily) || 0,
        min_nights: parseInt(minNights) || 1,
        is_active: true,
      }

      if (startDate) basePriceData.start_date = startDate
      if (endDate) basePriceData.end_date = endDate

      if (priceId) {
        // Editing: update the original record with the first selected unit
        const firstUnitId = selectedUnitIds[0]

        const { error: updateError } = await supabase
          .from('pricing')
          .update({ ...basePriceData, unit_id: firstUnitId })
          .eq('id', priceId)

        if (updateError) throw updateError

        // If additional units were selected beyond the first, create new records for them
        const additionalUnitIds = selectedUnitIds.slice(1)
        if (additionalUnitIds.length > 0) {
          const newRecords = additionalUnitIds.map(uid => ({
            ...basePriceData,
            unit_id: uid,
          }))

          const { error: insertError } = await supabase
            .from('pricing')
            .insert(newRecords)

          if (insertError) throw insertError
        }
      } else {
        // Batch insert for all selected units
        const records = selectedUnitIds.map(uid => ({
          ...basePriceData,
          unit_id: uid,
        }))

        const { error } = await supabase
          .from('pricing')
          .insert(records)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      const count = selectedUnitIds.length
      toast({
        title: 'نجح',
        description: isEditing
          ? count > 1
            ? `تم تحديث السعر وإضافته لـ ${count} وحدة`
            : 'تم تحديث السعر بنجاح'
          : `تم إضافة السعر بنجاح لـ ${count} وحدة`,
      })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ السعر',
        variant: 'destructive',
      })
    },
  })

  function handleReset() {
    setSelectedUnitIds([])
    setSelectedLocation('')
    setPricingType('standard')
    setPriceMilitary('')
    setPriceCivilian('')
    setPriceMember('')
    setPriceArtilleryFamily('')
    setMinNights('1')
    setStartDate('')
    setEndDate('')
    setUnitSearch('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!priceMilitary && !priceCivilian && !priceMember && !priceArtilleryFamily) {
          toast({
            title: 'خطأ',
            description: 'يجب إدخال سعر واحد على الأقل',
            variant: 'destructive',
          })
          return
        }
        if (selectedUnitIds.length === 0) {
          toast({
            title: 'خطأ',
            description: 'يجب اختيار وحدة واحدة على الأقل',
            variant: 'destructive',
          })
          return
        }
        savePrice.mutate()
      }}
      className="space-y-4"
    >
      {/* Location Filter */}
      <div className="space-y-2">
        <Label className="text-base font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          الموقع
        </Label>
        <Select value={selectedLocation || 'all'} onValueChange={(v) => setSelectedLocation(v === 'all' ? '' : v)}>
          <SelectTrigger className="border-2 focus:border-blue-500">
            <SelectValue placeholder="جميع المواقع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المواقع</SelectItem>
            {locations?.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name_ar || loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Unit Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">الوحدات *</Label>
          {selectedUnitIds.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm">
              <CheckCheck className="w-3.5 h-3.5" />
              {selectedUnitIds.length} محددة
            </span>
          )}
        </div>
        {/* Search + Select/Deselect All */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="بحث عن وحدة..."
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            className="border-2 focus:border-blue-500 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAllUnits}
            className="text-xs whitespace-nowrap border-2 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            تحديد الكل
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deselectAllUnits}
            className="text-xs whitespace-nowrap border-2 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            إلغاء الكل
          </Button>
        </div>
        {/* Scrollable unit checkbox list */}
        <div className="max-h-[200px] overflow-y-auto border-2 rounded-lg p-2 space-y-1 bg-white dark:bg-slate-900">
          {filteredUnits && filteredUnits.length > 0 ? (
            filteredUnits.map(unit => {
              const isSelected = selectedUnitIds.includes(unit.id)
              return (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => toggleUnit(unit.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-300 dark:border-blue-700 shadow-sm'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-transparent'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-500 border-blue-500 shadow-sm'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                    {unit.unit_number}
                  </div>
                  <span className="font-medium text-right flex-1">{unit.name_ar || unit.name || unit.unit_number}</span>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    {unitTypeLabels[unit.type] || unit.type}
                  </span>
                </button>
              )
            })
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">لا توجد وحدات</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pricing_type">نوع السعر</Label>
        <Select value={pricingType} onValueChange={setPricingType}>
          <SelectTrigger className="border-2 focus:border-blue-500">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">قياسي</SelectItem>
            <SelectItem value="seasonal">موسمي</SelectItem>
            <SelectItem value="weekend">عطلة نهاية الأسبوع</SelectItem>
            <SelectItem value="holiday">عطلة</SelectItem>
            <SelectItem value="group">مجموعة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">تاريخ البداية</Label>
          <Input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border-2 focus:border-blue-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">تاريخ النهاية</Label>
          <Input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            className="border-2 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-lg font-semibold">الأسعار حسب نوع الضيف *</Label>
        <p className="text-sm text-muted-foreground">أدخل سعر واحد على الأقل</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* عسكري - Military */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
              <Label htmlFor="price_military" className="font-semibold text-green-900 dark:text-green-200">سعر عسكري (ج.م)</Label>
            </div>
            <Input
              id="price_military"
              type="number"
              step="0.01"
              min="0"
              value={priceMilitary}
              onChange={(e) => setPriceMilitary(e.target.value)}
              placeholder="0.00"
              className="border-2 focus:border-green-500 bg-white dark:bg-slate-900"
            />
          </div>

          {/* مدني - Civilian */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <Label htmlFor="price_civilian" className="font-semibold text-blue-900 dark:text-blue-200">سعر مدني (ج.م)</Label>
            </div>
            <Input
              id="price_civilian"
              type="number"
              step="0.01"
              min="0"
              value={priceCivilian}
              onChange={(e) => setPriceCivilian(e.target.value)}
              placeholder="0.00"
              className="border-2 focus:border-blue-500 bg-white dark:bg-slate-900"
            />
          </div>

          {/* عضو دار - Club Member */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-2 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <Label htmlFor="price_member" className="font-semibold text-purple-900 dark:text-purple-200">سعر عضو دار (ج.م)</Label>
            </div>
            <Input
              id="price_member"
              type="number"
              step="0.01"
              min="0"
              value={priceMember}
              onChange={(e) => setPriceMember(e.target.value)}
              placeholder="0.00"
              className="border-2 focus:border-purple-500 bg-white dark:bg-slate-900"
            />
          </div>

          {/* أبناء مدفعية - Artillery Family */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-red-600 dark:text-red-400" />
              <Label htmlFor="price_artillery_family" className="font-semibold text-red-900 dark:text-red-200">سعر أبناء مدفعية (ج.م)</Label>
            </div>
            <Input
              id="price_artillery_family"
              type="number"
              step="0.01"
              min="0"
              value={priceArtilleryFamily}
              onChange={(e) => setPriceArtilleryFamily(e.target.value)}
              placeholder="0.00"
              className="border-2 focus:border-red-500 bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="min_nights">الحد الأدنى من الليالي</Label>
        <Input
          id="min_nights"
          type="number"
          min="1"
          value={minNights}
          onChange={(e) => setMinNights(e.target.value)}
          className="border-2 focus:border-blue-500"
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
        >
          إعادة تعيين
        </Button>
        <Button
          type="submit"
          disabled={savePrice.isPending}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
        >
          {savePrice.isPending ? 'جاري الحفظ...' : `حفظ (${selectedUnitIds.length} وحدة)`}
        </Button>
      </DialogFooter>
    </form>
  )
}
