'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit, Trash2, Wrench, CheckCircle, AlertTriangle, Clock, Settings, MapPin } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { useUnits } from '@/lib/hooks/use-units'
import { useLocations } from '@/lib/hooks/use-locations'
import { motion, AnimatePresence } from 'framer-motion'

export default function MaintenancePage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const queryClient = useQueryClient()
  const { data: units } = useUnits()
  const { data: locations } = useLocations()

  const { data: maintenanceRecords, isLoading } = useQuery({
    queryKey: ['maintenance'],
    queryFn: async () => {
      // Get units in maintenance status
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('status', 'maintenance')
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  const updateUnitStatus = useMutation({
    mutationFn: async ({ unitId, status }: { unitId: string; status: string }) => {
      const { error } = await supabase
        .from('units')
        .update({ status })
        .eq('id', unitId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['units'] })
      toast({
        title: 'نجح',
        description: 'تم تحديث حالة الوحدة',
      })
    },
  })

  function handleMarkMaintenance(unitId: string) {
    updateUnitStatus.mutate({ unitId, status: 'maintenance' })
  }

  function handleMarkAvailable(unitId: string) {
    updateUnitStatus.mutate({ unitId, status: 'available' })
  }

  // Calculate statistics
  const totalMaintenance = maintenanceRecords?.length || 0
  const totalUnits = units?.length || 0
  const maintenancePercentage = totalUnits > 0 ? ((totalMaintenance / totalUnits) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold mb-2 text-slate-900 dark:text-slate-100"
          >
            الصيانة
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
              🔧
            </motion.span>
            إدارة صيانة الوحدات
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) setEditingMaintenance(null)
          }}>
            <DialogTrigger asChild>
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={() => setEditingMaintenance(null)}
                  className="relative overflow-hidden group border-2 hover:border-primary transition-all bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                >
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
                  <span className="relative z-10">إضافة صيانة</span>
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">إضافة صيانة</DialogTitle>
              </DialogHeader>
              <MaintenanceForm
                onSuccess={() => {
                  setDialogOpen(false)
                  setEditingMaintenance(null)
                }}
              />
            </DialogContent>
          </Dialog>
        </motion.div>
      </motion.div>

      {/* Premium Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className="relative group"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl transition-all duration-300 bg-gradient-to-br from-red-500 via-rose-600 to-pink-600 backdrop-blur-sm">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-white/90 drop-shadow-md">
                الوحدات قيد الصيانة
              </CardTitle>
              <motion.div
                className="bg-red-500/10 p-2.5 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
                whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
              >
                <Wrench className="h-5 w-5 text-white drop-shadow-md" />
              </motion.div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-white drop-shadow-lg">{totalMaintenance}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className="relative group"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 backdrop-blur-sm">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-white/90 drop-shadow-md">
                إجمالي الوحدات
              </CardTitle>
              <motion.div
                className="bg-blue-500/10 p-2.5 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
                whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
              >
                <Settings className="h-5 w-5 text-white drop-shadow-md" />
              </motion.div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-white drop-shadow-lg">{totalUnits}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className="relative group"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl transition-all duration-300 bg-gradient-to-br from-yellow-500 via-amber-600 to-orange-600 backdrop-blur-sm">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-white/90 drop-shadow-md">
                نسبة الصيانة
              </CardTitle>
              <motion.div
                className="bg-yellow-500/10 p-2.5 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg"
                whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
              >
                <AlertTriangle className="h-5 w-5 text-white drop-shadow-md" />
              </motion.div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold text-white drop-shadow-lg">{maintenancePercentage}%</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Premium Maintenance List Card */}
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/30 dark:via-rose-950/30 dark:to-pink-950/30 backdrop-blur-sm">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          
          <CardHeader className="relative z-10 border-b border-red-200/50 dark:border-red-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
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
                  <Wrench className="h-6 w-6 text-red-600" />
                </motion.div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                  الوحدات قيد الصيانة
                </CardTitle>
              </div>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-40 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-red-400/50 transition-all text-sm">
                  <MapPin className="h-3.5 w-3.5 text-red-500 mr-1.5" />
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {locations?.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name_ar || loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : maintenanceRecords && maintenanceRecords.filter(u => !selectedLocation || selectedLocation === 'all' || u.location_id === selectedLocation).length > 0 ? (
              <AnimatePresence>
                <div className="space-y-3">
                  {maintenanceRecords.filter(u => !selectedLocation || selectedLocation === 'all' || u.location_id === selectedLocation).map((unit, index) => {
                    const locationName = locations?.find(l => l.id === unit.location_id)
                    return (
                    <motion.div
                      key={unit.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="flex items-center justify-between p-4 border-2 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-red-200/50 dark:border-red-800/50 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <motion.div
                            animate={{
                              scale: [1, 1.1, 1],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          </motion.div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {unit.unit_number} - {unit.name_ar || unit.name}
                          </p>
                          {locationName && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {locationName.name_ar || locationName.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>آخر تحديث: {formatDateShort(unit.updated_at)}</span>
                        </div>
                      </div>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAvailable(unit.id)}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-md hover:shadow-lg"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          إكمال الصيانة
                        </Button>
                      </motion.div>
                    </motion.div>
                    )
                  })}
                </div>
              </AnimatePresence>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="mb-4"
                >
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500 opacity-50" />
                </motion.div>
                <p className="text-muted-foreground font-medium">لا توجد وحدات قيد الصيانة</p>
                <p className="text-sm text-muted-foreground mt-2">جميع الوحدات جاهزة للاستخدام</p>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Premium Add Maintenance Card */}
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          
          <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{
                  rotate: [0, -360],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <Settings className="h-6 w-6 text-blue-600" />
              </motion.div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                إضافة وحدة للصيانة
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-4">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-2"
              >
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  اختر الموقع
                </Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-primary/50 transition-all">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {locations?.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name_ar || loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <Label className="font-semibold text-slate-700 dark:text-slate-300">اختر الوحدة</Label>
                <Select
                  onValueChange={(unitId) => {
                    const unit = units?.find(u => u.id === unitId)
                    if (unit && unit.status !== 'maintenance') {
                      handleMarkMaintenance(unitId)
                    }
                  }}
                >
                  <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-primary/50 transition-all">
                    <SelectValue placeholder="اختر وحدة" />
                  </SelectTrigger>
                  <SelectContent>
                    {units?.filter(u => {
                      if (u.status === 'maintenance') return false
                      if (selectedLocation && selectedLocation !== 'all' && u.location_id !== selectedLocation) return false
                      return true
                    }).map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.unit_number} - {unit.name_ar || unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-xl bg-gradient-to-r from-blue-100/50 to-indigo-100/50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-800/50"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    اختر وحدة لإرسالها للصيانة. يمكنك إكمال الصيانة من القائمة على اليسار.
                  </p>
                </div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MaintenanceForm({ onSuccess }: { onSuccess?: () => void }) {
  const [unitId, setUnitId] = useState('')
  const [notes, setNotes] = useState('')
  const [formLocation, setFormLocation] = useState<string>('')
  const { data: units } = useUnits()
  const { data: locations } = useLocations()
  const queryClient = useQueryClient()

  const markMaintenance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('units')
        .update({
          status: 'maintenance',
        })
        .eq('id', unitId)

      if (error) throw error

      // Add maintenance note
      if (notes) {
        const unit = units?.find(u => u.id === unitId)
        if (unit) {
          await supabase
            .from('units')
            .update({
              description_ar: `${unit.description_ar || ''}\n[صيانة] ${notes}`.trim(),
            })
            .eq('id', unitId)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['units'] })
      toast({
        title: 'نجح',
        description: 'تم إرسال الوحدة للصيانة',
      })
      onSuccess?.()
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        markMaintenance.mutate()
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          الموقع
        </Label>
        <Select value={formLocation} onValueChange={(v) => { setFormLocation(v); setUnitId('') }}>
          <SelectTrigger>
            <SelectValue placeholder="الكل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {locations?.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>
                {loc.name_ar || loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="maintenance-unit">الوحدة *</Label>
        <Select value={unitId} onValueChange={setUnitId}>
          <SelectTrigger>
            <SelectValue placeholder="اختر الوحدة" />
          </SelectTrigger>
          <SelectContent>
            {units?.filter(u => {
              if (u.status === 'maintenance') return false
              if (formLocation && formLocation !== 'all' && u.location_id !== formLocation) return false
              return true
            }).map(unit => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.unit_number} - {unit.name_ar || unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="maintenance-notes">ملاحظات الصيانة</Label>
        <Textarea
          id="maintenance-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="وصف الصيانة المطلوبة..."
        />
      </div>
      <Button type="submit" disabled={markMaintenance.isPending || !unitId}>
        {markMaintenance.isPending ? 'جاري المعالجة...' : 'إرسال للصيانة'}
      </Button>
    </form>
  )
}

