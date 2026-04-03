'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateReservation } from '@/lib/hooks/use-reservations'
import { useUnits } from '@/lib/hooks/use-units'
import { useGuests } from '@/lib/hooks/use-guests'
import { useLocations } from '@/lib/hooks/use-locations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Repeat,
  ArrowLeft,
  Users,
  MapPin,
  Home,
  Clock,
  CalendarDays,
  CalendarCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Baby,
  User,
  DollarSign,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const recurringSchema = z.object({
  unit_id: z.string().min(1, 'يجب اختيار وحدة'),
  guest_id: z.string().min(1, 'يجب اختيار ضيف'),
  start_date: z.string().min(1, 'يجب اختيار تاريخ البداية'),
  end_date: z.string().min(1, 'يجب اختيار تاريخ النهاية'),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  occurrences: z.number().min(1).max(52),
  status: z.enum(['pending', 'confirmed']).default('pending'),
  adults: z.number().min(1).default(1),
  children: z.number().min(0).default(0),
  total_amount: z.number().min(0).default(0),
})

type RecurringFormData = z.infer<typeof recurringSchema>

const frequencyOptions = [
  { value: 'daily', label: 'يومي', icon: '📅', description: 'تكرار كل يوم' },
  { value: 'weekly', label: 'أسبوعي', icon: '📆', description: 'تكرار كل أسبوع' },
  { value: 'monthly', label: 'شهري', icon: '🗓️', description: 'تكرار كل شهر' },
]

const statusOptions = [
  { value: 'pending', label: 'قيد الانتظار', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'confirmed', label: 'مؤكد', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
]

export default function RecurringReservationsPage() {
  const router = useRouter()
  const createReservation = useCreateReservation()
  const { data: locations } = useLocations()
  const { data: units } = useUnits()
  const { data: guests } = useGuests()
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [currentStep, setCurrentStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [createdCount, setCreatedCount] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      frequency: 'weekly',
      occurrences: 4,
      status: 'pending',
      adults: 1,
      children: 0,
      total_amount: 0,
    },
  })

  const filteredUnits = units?.filter(u =>
    !selectedLocation || u.location_id === selectedLocation
  )

  const watchedValues = watch()
  const selectedUnit = units?.find(u => u.id === watchedValues.unit_id)
  const selectedGuest = guests?.find(g => g.id === watchedValues.guest_id)

  // Generate preview dates
  const previewDates = useMemo(() => {
    if (!watchedValues.start_date || !watchedValues.end_date) return []

    const startDate = new Date(watchedValues.start_date)
    const endDate = new Date(watchedValues.end_date)
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (duration <= 0) return []

    const dates = []
    let currentDate = new Date(startDate)

    for (let i = 0; i < (watchedValues.occurrences || 0); i++) {
      const checkIn = new Date(currentDate)
      const checkOut = new Date(currentDate)
      checkOut.setDate(checkOut.getDate() + duration)

      dates.push({
        index: i + 1,
        checkIn: checkIn.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }),
        checkOut: checkOut.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }),
        nights: duration,
      })

      if (watchedValues.frequency === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1)
      } else if (watchedValues.frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7)
      } else if (watchedValues.frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
    }

    return dates
  }, [watchedValues.start_date, watchedValues.end_date, watchedValues.frequency, watchedValues.occurrences])

  const totalAmount = (watchedValues.total_amount || 0) * (watchedValues.occurrences || 0)

  async function onSubmit(data: RecurringFormData) {
    try {
      setIsCreating(true)
      setCreatedCount(0)

      const startDate = new Date(data.start_date)
      const endDate = new Date(data.end_date)
      const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

      const reservations = []
      let currentDate = new Date(startDate)

      for (let i = 0; i < data.occurrences; i++) {
        const checkIn = new Date(currentDate)
        const checkOut = new Date(currentDate)
        checkOut.setDate(checkOut.getDate() + duration)

        reservations.push({
          unit_id: data.unit_id,
          guest_id: data.guest_id,
          check_in_date: checkIn.toISOString().split('T')[0],
          check_out_date: checkOut.toISOString().split('T')[0],
          status: data.status,
          source: 'online' as const,
          adults: data.adults,
          children: data.children,
          total_amount: data.total_amount,
        })

        if (data.frequency === 'daily') {
          currentDate.setDate(currentDate.getDate() + 1)
        } else if (data.frequency === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7)
        } else if (data.frequency === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1)
        }
      }

      for (const reservation of reservations) {
        await createReservation.mutateAsync(reservation)
        setCreatedCount(prev => prev + 1)
      }

      toast({
        title: '✅ تم بنجاح',
        description: `تم إنشاء ${reservations.length} حجز متكرر بنجاح`,
      })
      router.push('/reservations')
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء الحجوزات المتكررة',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const steps = [
    { title: 'الوحدة والضيف', icon: Home },
    { title: 'التواريخ والتكرار', icon: CalendarDays },
    { title: 'التفاصيل والمعاينة', icon: Sparkles },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20">
      {/* Animated Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-violet-400/10 to-fuchsia-400/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -20, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-amber-400/5 to-orange-400/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 p-6 max-w-6xl mx-auto space-y-8">
        {/* Premium Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div className="flex items-center gap-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link href="/reservations">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-blue-400 shadow-lg hover:shadow-xl transition-all"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent"
              >
                حجوزات متكررة
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground flex items-center gap-2 mt-1"
              >
                <motion.span
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                >
                  <Repeat className="h-4 w-4 text-violet-500" />
                </motion.span>
                إنشاء حجوزات متكررة تلقائياً بسهولة
              </motion.p>
            </div>
          </div>
        </motion.div>

        {/* Step Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const StepIcon = step.icon
                  const isActive = index === currentStep
                  const isCompleted = index < currentStep
                  return (
                    <div key={index} className="flex items-center flex-1">
                      <motion.button
                        type="button"
                        onClick={() => setCurrentStep(index)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 cursor-pointer',
                          isActive
                            ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25'
                            : isCompleted
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <motion.div
                          animate={isActive ? { rotate: [0, 10, -10, 0] } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <StepIcon className="h-5 w-5" />
                          )}
                        </motion.div>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs opacity-75">الخطوة {index + 1}</p>
                          <p className="text-sm font-bold">{step.title}</p>
                        </div>
                      </motion.button>
                      {index < steps.length - 1 && (
                        <div className="flex-1 mx-3">
                          <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                              initial={{ width: '0%' }}
                              animate={{ width: index < currentStep ? '100%' : '0%' }}
                              transition={{ duration: 0.5, ease: 'easeInOut' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <AnimatePresence mode="wait">
            {/* Step 1: Unit & Guest */}
            {currentStep === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
                className="grid gap-6 md:grid-cols-2"
              >
                {/* Location & Unit Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="relative overflow-hidden border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-full group hover:shadow-2xl transition-shadow duration-300">
                    <div className="absolute inset-0 opacity-[0.03]">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#6366f1_1px,transparent_1px),linear-gradient(to_bottom,#6366f1_1px,transparent_1px)] bg-[size:24px_24px]" />
                    </div>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-200/10 to-transparent"
                      animate={{ x: ['-200%', '200%'] }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
                    />
                    <CardHeader className="relative z-10 border-b border-violet-200/30 dark:border-violet-800/30">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-200/50 dark:border-violet-800/50"
                          animate={{ rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 4, repeat: Infinity }}
                        >
                          <MapPin className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                          الموقع والوحدة
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 pt-6 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-violet-500" />
                          الموقع
                        </Label>
                        <Select
                          value={selectedLocation}
                          onValueChange={setSelectedLocation}
                        >
                          <SelectTrigger className="h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-violet-400 focus:border-violet-500 rounded-xl transition-all shadow-sm">
                            <SelectValue placeholder="اختر الموقع..." />
                          </SelectTrigger>
                          <SelectContent>
                            {locations?.map(location => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name_ar || location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Home className="h-4 w-4 text-violet-500" />
                          الوحدة <span className="text-red-400">*</span>
                        </Label>
                        <Select
                          onValueChange={(value) => setValue('unit_id', value)}
                        >
                          <SelectTrigger className={cn(
                            "h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 rounded-xl transition-all shadow-sm",
                            errors.unit_id ? "border-red-400 hover:border-red-500" : "hover:border-violet-400 focus:border-violet-500"
                          )}>
                            <SelectValue placeholder="اختر الوحدة..." />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredUnits?.map(unit => (
                              <SelectItem key={unit.id} value={unit.id}>
                                <span className="flex items-center gap-2">
                                  <span className="font-mono text-xs bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 rounded">
                                    {unit.unit_number}
                                  </span>
                                  {unit.name_ar || unit.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.unit_id && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errors.unit_id.message}
                          </motion.p>
                        )}
                      </div>

                      {selectedUnit && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200/50 dark:border-violet-800/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-violet-500/10">
                              <Home className="h-4 w-4 text-violet-600" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100">{selectedUnit.name_ar || selectedUnit.name}</p>
                              <p className="text-xs text-slate-500">وحدة {selectedUnit.unit_number}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Guest Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="relative overflow-hidden border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-full group hover:shadow-2xl transition-shadow duration-300">
                    <div className="absolute inset-0 opacity-[0.03]">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#3b82f6_1px,transparent_1px),linear-gradient(to_bottom,#3b82f6_1px,transparent_1px)] bg-[size:24px_24px]" />
                    </div>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/10 to-transparent"
                      animate={{ x: ['-200%', '200%'] }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 4 }}
                    />
                    <CardHeader className="relative z-10 border-b border-blue-200/30 dark:border-blue-800/30">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200/50 dark:border-blue-800/50"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        >
                          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                          بيانات الضيف
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 pt-6 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-500" />
                          الضيف <span className="text-red-400">*</span>
                        </Label>
                        <Select
                          onValueChange={(value) => setValue('guest_id', value)}
                        >
                          <SelectTrigger className={cn(
                            "h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 rounded-xl transition-all shadow-sm",
                            errors.guest_id ? "border-red-400 hover:border-red-500" : "hover:border-blue-400 focus:border-blue-500"
                          )}>
                            <SelectValue placeholder="اختر الضيف..." />
                          </SelectTrigger>
                          <SelectContent>
                            {guests?.map(guest => (
                              <SelectItem key={guest.id} value={guest.id}>
                                {guest.first_name} {guest.last_name}
                                {guest.phone && (
                                  <span className="text-slate-400 mr-2">({guest.phone})</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.guest_id && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errors.guest_id.message}
                          </motion.p>
                        )}
                      </div>

                      {selectedGuest && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200/50 dark:border-blue-800/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                              {(selectedGuest.first_name?.[0] || '').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100">
                                {selectedGuest.first_name} {selectedGuest.last_name}
                              </p>
                              <p className="text-xs text-slate-500">{selectedGuest.phone}</p>
                              {selectedGuest.guest_type && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {selectedGuest.guest_type === 'military' ? 'عسكري' :
                                    selectedGuest.guest_type === 'civilian' ? 'مدني' : selectedGuest.guest_type}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-blue-500" />
                          حالة الحجوزات
                        </Label>
                        <div className="flex gap-3">
                          {statusOptions.map(option => (
                            <motion.button
                              key={option.value}
                              type="button"
                              onClick={() => setValue('status', option.value as any)}
                              className={cn(
                                'flex-1 py-3 px-4 rounded-xl border-2 transition-all font-semibold text-sm',
                                watchedValues.status === option.value
                                  ? option.value === 'confirmed'
                                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 shadow-lg shadow-emerald-500/10'
                                    : 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 shadow-lg shadow-amber-500/10'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              )}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {option.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}

            {/* Step 2: Dates & Frequency */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
                className="grid gap-6 md:grid-cols-2"
              >
                {/* Date Selection Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="relative overflow-hidden border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-full group hover:shadow-2xl transition-shadow duration-300">
                    <div className="absolute inset-0 opacity-[0.03]">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f59e0b_1px,transparent_1px),linear-gradient(to_bottom,#f59e0b_1px,transparent_1px)] bg-[size:24px_24px]" />
                    </div>
                    <CardHeader className="relative z-10 border-b border-amber-200/30 dark:border-amber-800/30">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-200/50 dark:border-amber-800/50"
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                        >
                          <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                          التواريخ
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 pt-6 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <CalendarCheck className="h-4 w-4 text-amber-500" />
                          تاريخ البداية <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="date"
                          className="h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-amber-400 focus:border-amber-500 rounded-xl transition-all shadow-sm"
                          {...register('start_date')}
                        />
                        {errors.start_date && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errors.start_date.message}
                          </motion.p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-amber-500" />
                          تاريخ النهاية (للحجز الأول) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="date"
                          className="h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-amber-400 focus:border-amber-500 rounded-xl transition-all shadow-sm"
                          {...register('end_date')}
                        />
                        {errors.end_date && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errors.end_date.message}
                          </motion.p>
                        )}
                      </div>

                      {watchedValues.start_date && watchedValues.end_date && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/50"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span className="font-bold text-amber-700 dark:text-amber-400">
                              مدة الحجز الواحد: {Math.ceil((new Date(watchedValues.end_date).getTime() - new Date(watchedValues.start_date).getTime()) / (1000 * 60 * 60 * 24))} ليلة
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Frequency Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="relative overflow-hidden border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-full group hover:shadow-2xl transition-shadow duration-300">
                    <div className="absolute inset-0 opacity-[0.03]">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b981_1px,transparent_1px),linear-gradient(to_bottom,#10b981_1px,transparent_1px)] bg-[size:24px_24px]" />
                    </div>
                    <CardHeader className="relative z-10 border-b border-emerald-200/30 dark:border-emerald-800/30">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200/50 dark:border-emerald-800/50"
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        >
                          <Repeat className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                          إعدادات التكرار
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 pt-6 space-y-5">
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          نمط التكرار
                        </Label>
                        <div className="grid grid-cols-3 gap-3">
                          {frequencyOptions.map((option) => (
                            <motion.button
                              key={option.value}
                              type="button"
                              onClick={() => setValue('frequency', option.value as any)}
                              className={cn(
                                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                                watchedValues.frequency === option.value
                                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/10'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                              )}
                              whileHover={{ scale: 1.03, y: -2 }}
                              whileTap={{ scale: 0.97 }}
                            >
                              <span className="text-2xl">{option.icon}</span>
                              <span className={cn(
                                'text-sm font-bold',
                                watchedValues.frequency === option.value
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-600 dark:text-slate-400'
                              )}>
                                {option.label}
                              </span>
                              <span className="text-[10px] text-slate-400">{option.description}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Repeat className="h-4 w-4 text-emerald-500" />
                          عدد المرات
                        </Label>
                        <div className="flex items-center gap-3">
                          <motion.button
                            type="button"
                            onClick={() => {
                              const current = watchedValues.occurrences || 1
                              if (current > 1) setValue('occurrences', current - 1)
                            }}
                            className="h-12 w-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400 flex items-center justify-center transition-all bg-white/70 dark:bg-slate-800/70"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <ChevronRight className="h-5 w-5" />
                          </motion.button>
                          <Input
                            type="number"
                            min="1"
                            max="52"
                            className="h-12 text-center text-2xl font-bold bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-emerald-400 focus:border-emerald-500 rounded-xl transition-all shadow-sm"
                            {...register('occurrences', { valueAsNumber: true })}
                          />
                          <motion.button
                            type="button"
                            onClick={() => {
                              const current = watchedValues.occurrences || 1
                              if (current < 52) setValue('occurrences', current + 1)
                            }}
                            className="h-12 w-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400 flex items-center justify-center transition-all bg-white/70 dark:bg-slate-800/70"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </motion.button>
                        </div>
                        {errors.occurrences && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errors.occurrences.message}
                          </motion.p>
                        )}
                      </div>

                      {/* Summary Badge */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/50 dark:border-emerald-800/50 text-center"
                      >
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                          سيتم إنشاء{' '}
                          <span className="text-2xl bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            {watchedValues.occurrences || 0}
                          </span>{' '}
                          حجز{' '}
                          {watchedValues.frequency === 'daily' ? 'يومياً' :
                            watchedValues.frequency === 'weekly' ? 'أسبوعياً' : 'شهرياً'}
                        </p>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}

            {/* Step 3: Details & Preview */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
                className="grid gap-6 md:grid-cols-2"
              >
                {/* Additional Details */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-6"
                >
                  <Card className="relative overflow-hidden border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl group hover:shadow-2xl transition-shadow duration-300">
                    <div className="absolute inset-0 opacity-[0.03]">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ec4899_1px,transparent_1px),linear-gradient(to_bottom,#ec4899_1px,transparent_1px)] bg-[size:24px_24px]" />
                    </div>
                    <CardHeader className="relative z-10 border-b border-pink-200/30 dark:border-pink-800/30">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-200/50 dark:border-pink-800/50"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                          معلومات إضافية
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 pt-6 space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <User className="h-4 w-4 text-pink-500" />
                            البالغين
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            className="h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-pink-400 focus:border-pink-500 rounded-xl transition-all shadow-sm text-center text-lg font-bold"
                            {...register('adults', { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Baby className="h-4 w-4 text-pink-500" />
                            الأطفال
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            className="h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-pink-400 focus:border-pink-500 rounded-xl transition-all shadow-sm text-center text-lg font-bold"
                            {...register('children', { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-pink-500" />
                          المبلغ لكل حجز (جنيه مصري)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-pink-400 focus:border-pink-500 rounded-xl transition-all shadow-sm text-lg font-bold"
                          {...register('total_amount', { valueAsNumber: true })}
                        />
                      </div>

                      {totalAmount > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 border border-pink-200/50 dark:border-pink-800/50 text-center"
                        >
                          <p className="text-sm text-slate-500 mb-1">الإجمالي الكلي</p>
                          <p className="text-3xl font-black bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                            {totalAmount.toLocaleString('ar-EG')} ج.م
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {watchedValues.total_amount?.toLocaleString('ar-EG')} × {watchedValues.occurrences} حجز
                          </p>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Preview Timeline */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="relative overflow-hidden border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-full group hover:shadow-2xl transition-shadow duration-300">
                    <div className="absolute inset-0 opacity-[0.03]">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8b5cf6_1px,transparent_1px),linear-gradient(to_bottom,#8b5cf6_1px,transparent_1px)] bg-[size:24px_24px]" />
                    </div>
                    <CardHeader className="relative z-10 border-b border-violet-200/30 dark:border-violet-800/30">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-200/50 dark:border-violet-800/50"
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                        >
                          <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </motion.div>
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                          معاينة الحجوزات
                        </CardTitle>
                        {previewDates.length > 0 && (
                          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0">
                            {previewDates.length} حجز
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 pt-4">
                      {previewDates.length === 0 ? (
                        <div className="text-center py-12">
                          <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <CalendarDays className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                          </motion.div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">
                            أكمل بيانات التواريخ لمعاينة الحجوزات
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin">
                          {previewDates.map((date, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="relative"
                            >
                              <div className="flex items-start gap-3">
                                {/* Timeline */}
                                <div className="flex flex-col items-center">
                                  <motion.div
                                    className={cn(
                                      'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg',
                                      index % 3 === 0 ? 'bg-gradient-to-br from-violet-500 to-purple-600' :
                                        index % 3 === 1 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                                          'bg-gradient-to-br from-emerald-500 to-teal-600'
                                    )}
                                    whileHover={{ scale: 1.2 }}
                                  >
                                    {date.index}
                                  </motion.div>
                                  {index < previewDates.length - 1 && (
                                    <div className="w-0.5 h-8 bg-gradient-to-b from-violet-300 to-transparent dark:from-violet-700" />
                                  )}
                                </div>
                                {/* Content */}
                                <div className="flex-1 pb-3">
                                  <motion.div
                                    className="p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all"
                                    whileHover={{ x: -3 }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                          {date.checkIn}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-400">←</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                          {date.checkOut}
                                        </span>
                                        <CalendarDays className="h-3.5 w-3.5 text-red-400" />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-[10px] py-0">
                                        {date.nights} ليلة
                                      </Badge>
                                      {watchedValues.total_amount > 0 && (
                                        <Badge variant="outline" className="text-[10px] py-0 text-emerald-600">
                                          {watchedValues.total_amount?.toLocaleString('ar-EG')} ج.م
                                        </Badge>
                                      )}
                                    </div>
                                  </motion.div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation & Submit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    {currentStep > 0 && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCurrentStep(prev => prev - 1)}
                          className="h-12 px-6 rounded-xl border-2 hover:border-violet-400 transition-all"
                        >
                          <ChevronRight className="h-4 w-4 ml-2" />
                          السابق
                        </Button>
                      </motion.div>
                    )}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        className="h-12 px-6 rounded-xl"
                      >
                        إلغاء
                      </Button>
                    </motion.div>
                  </div>

                  <div className="flex gap-3">
                    {currentStep < steps.length - 1 ? (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="button"
                          onClick={() => setCurrentStep(prev => prev + 1)}
                          className="h-12 px-8 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 shadow-lg shadow-violet-500/25 text-white transition-all"
                        >
                          التالي
                          <ChevronLeft className="h-4 w-4 mr-2" />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="submit"
                          disabled={isCreating}
                          className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 text-white transition-all disabled:opacity-70"
                        >
                          {isCreating ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              جاري الإنشاء... ({createdCount}/{watchedValues.occurrences || 0})
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4" />
                              إنشاء {watchedValues.occurrences || 0} حجز متكرر
                            </span>
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Creation progress bar */}
                {isCreating && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4"
                  >
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${((createdCount) / (watchedValues.occurrences || 1)) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      تم إنشاء {createdCount} من {watchedValues.occurrences || 0} حجز
                    </p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </form>
      </div>
    </div>
  )
}
