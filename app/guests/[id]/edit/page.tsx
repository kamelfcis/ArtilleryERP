'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { guestSchema, type GuestFormData } from '@/lib/validations/guest'
import { useGuest, useUpdateGuest } from '@/lib/hooks/use-guests'
import { Guest, GuestType } from '@/lib/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  User, Phone, Mail, CreditCard, Shield, Building2, FileText, 
  Edit, ArrowRight, Save, X, Users
} from 'lucide-react'
import Link from 'next/link'

// Military ranks in Arabic
const MILITARY_RANKS = [
  { value: 'مشير', label: 'مشير' },
  { value: 'فريق أول', label: 'فريق أول' },
  { value: 'فريق', label: 'فريق' },
  { value: 'لواء', label: 'لواء' },
  { value: 'عميد', label: 'عميد' },
  { value: 'عقيد', label: 'عقيد' },
  { value: 'مقدم', label: 'مقدم' },
  { value: 'رائد', label: 'رائد' },
  { value: 'نقيب', label: 'نقيب' },
  { value: 'ملازم أول', label: 'ملازم أول' },
  { value: 'ملازم', label: 'ملازم' },
  { value: 'رقيب أول', label: 'رقيب أول' },
  { value: 'رقيب', label: 'رقيب' },
  { value: 'عريف', label: 'عريف' },
  { value: 'جندي أول', label: 'جندي أول' },
  { value: 'جندي', label: 'جندي' },
]

const GUEST_TYPES = [
  { value: 'military', label: 'عسكري', color: 'from-blue-500 to-indigo-600' },
  { value: 'civilian', label: 'مدني', color: 'from-green-500 to-emerald-600' },
  { value: 'club_member', label: 'عضو دار', color: 'from-purple-500 to-violet-600' },
  { value: 'artillery_family', label: 'ابناء مدفعية', color: 'from-red-500 to-rose-600' },
]

export default function EditGuestPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: guest, isLoading } = useGuest(id)
  const updateGuest = useUpdateGuest()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    reset,
    watch,
  } = useForm<GuestFormData>({
    resolver: zodResolver(guestSchema),
  })

  // Debug: Log form errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log('Form validation errors:', errors)
    }
  }, [errors])

  const currentGuestType = watch('guest_type')

  useEffect(() => {
    if (guest) {
      reset({
        first_name: guest.first_name || '',
        last_name: guest.last_name || '',
        first_name_ar: guest.first_name_ar || '',
        last_name_ar: guest.last_name_ar || '',
        email: guest.email || '',
        phone: guest.phone || '',
        national_id: guest.national_id || '',
        military_rank: guest.military_rank || '',
        military_rank_ar: guest.military_rank_ar || '',
        unit: guest.unit || '',
        unit_ar: guest.unit_ar || '',
        guest_type: guest.guest_type || 'military',
        notes: guest.notes || '',
      })
    }
  }, [guest, reset])

  async function onSubmit(data: GuestFormData) {
    console.log('Form submitted with data:', data)
    try {
      // Prepare update data with proper type handling
      const updateData: Partial<Guest> & { id: string } = {
        id,
        first_name: data.first_name,
        last_name: data.last_name,
        first_name_ar: data.first_name_ar,
        last_name_ar: data.last_name_ar,
        email: data.email,
        phone: data.phone,
        national_id: data.national_id,
        military_rank: data.military_rank,
        military_rank_ar: data.military_rank_ar,
        unit: data.unit,
        unit_ar: data.unit_ar,
        guest_type: (data.guest_type || 'military') as GuestType,
        notes: data.notes,
      }
      const result = await updateGuest.mutateAsync(updateData)
      console.log('Update successful:', result)
      toast({
        title: 'نجح',
        description: 'تم تحديث بيانات الضيف بنجاح',
      })
      router.push(`/guests/${id}`)
    } catch (error: any) {
      console.error('Update error:', error)
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث بيانات الضيف',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!guest) {
    return (
      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <p className="text-muted-foreground text-lg">الضيف غير موجود</p>
        </motion.div>
      </div>
    )
  }

  const guestTypeInfo = GUEST_TYPES.find(t => t.value === (currentGuestType || guest.guest_type)) || GUEST_TYPES[0]

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div className="flex-1 min-w-[300px]">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 mb-3"
          >
            <motion.div
              className={`p-3 rounded-xl bg-gradient-to-br ${guestTypeInfo.color} shadow-lg`}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            >
              <Edit className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent">
                تعديل الضيف
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">
                  {guest.first_name_ar || guest.first_name} {guest.last_name_ar || guest.last_name}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${guestTypeInfo.color} text-white`}>
                  {guestTypeInfo.label}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link href={`/guests/${id}`}>
              <Button variant="outline" className="border-2 hover:border-primary transition-all">
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة للتفاصيل
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Hidden fields for Arabic names */}
        <input type="hidden" {...register('first_name_ar')} />
        <input type="hidden" {...register('last_name_ar')} />
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm h-full">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 rounded-lg bg-blue-500/10"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <User className="h-5 w-5 text-blue-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    المعلومات الشخصية
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="flex items-center gap-2 font-medium">
                      <User className="h-4 w-4 text-blue-500" />
                      الاسم الأول (EN) *
                    </Label>
                    <Input
                      id="first_name"
                      {...register('first_name')}
                      className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-blue-400 transition-all"
                      dir="ltr"
                    />
                    {errors.first_name && (
                      <p className="text-sm text-destructive">{errors.first_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="flex items-center gap-2 font-medium">
                      <User className="h-4 w-4 text-blue-500" />
                      اسم العائلة (EN) *
                    </Label>
                    <Input
                      id="last_name"
                      {...register('last_name')}
                      className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-blue-400 transition-all"
                      dir="ltr"
                    />
                    {errors.last_name && (
                      <p className="text-sm text-destructive">{errors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="national_id" className="flex items-center gap-2 font-medium">
                    <CreditCard className="h-4 w-4 text-orange-500" />
                    الهوية الوطنية
                  </Label>
                  <Input
                    id="national_id"
                    {...register('national_id')}
                    className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-orange-400 transition-all"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/30 dark:via-emerald-950/30 dark:to-teal-950/30 backdrop-blur-sm h-full">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              <CardHeader className="relative z-10 border-b border-green-200/50 dark:border-green-800/50">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 rounded-lg bg-green-500/10"
                    animate={{ rotate: [0, -360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <Phone className="h-5 w-5 text-green-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    معلومات الاتصال
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2 font-medium">
                    <Phone className="h-4 w-4 text-green-500" />
                    رقم الهاتف *
                  </Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-green-400 transition-all"
                    dir="ltr"
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 font-medium">
                    <Mail className="h-4 w-4 text-purple-500" />
                    البريد الإلكتروني
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                    dir="ltr"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest_type" className="flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4 text-teal-500" />
                    نوع الضيف
                  </Label>
                  <Select
                    value={currentGuestType || guest.guest_type}
                    onValueChange={(value) => {
                      setValue('guest_type', value as any)
                      if (value !== 'military') {
                        setValue('military_rank_ar', '')
                        setValue('military_rank', '')
                        setValue('unit', '')
                        setValue('unit_ar', '')
                      }
                    }}
                  >
                    <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-teal-400 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GUEST_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Military Info Card - Only for military guests */}
          {(currentGuestType === 'military' || (!currentGuestType && guest.guest_type === 'military')) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 dark:from-purple-950/30 dark:via-violet-950/30 dark:to-indigo-950/30 backdrop-blur-sm h-full">
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
                </div>
                <CardHeader className="relative z-10 border-b border-purple-200/50 dark:border-purple-800/50">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="p-2 rounded-lg bg-purple-500/10"
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    >
                      <Shield className="h-5 w-5 text-purple-600" />
                    </motion.div>
                    <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                      المعلومات العسكرية
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10 pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="military_rank" className="flex items-center gap-2 font-medium">
                        <Shield className="h-4 w-4 text-purple-500" />
                        الرتبة (EN)
                      </Label>
                      <Input
                        id="military_rank"
                        {...register('military_rank')}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-purple-400 transition-all"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="military_rank_ar" className="flex items-center gap-2 font-medium">
                        <Shield className="h-4 w-4 text-violet-500" />
                        الرتبة (AR)
                      </Label>
                      <Select
                        value={watch('military_rank_ar') || ''}
                        onValueChange={(value) => setValue('military_rank_ar', value)}
                      >
                        <SelectTrigger className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-violet-400 transition-all">
                          <SelectValue placeholder="اختر الرتبة" />
                        </SelectTrigger>
                        <SelectContent>
                          {MILITARY_RANKS.map((rank) => (
                            <SelectItem key={rank.value} value={rank.value}>
                              {rank.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="unit" className="flex items-center gap-2 font-medium">
                        <Building2 className="h-4 w-4 text-indigo-500" />
                        الوحدة (EN)
                      </Label>
                      <Input
                        id="unit"
                        {...register('unit')}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-indigo-400 transition-all"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit_ar" className="flex items-center gap-2 font-medium">
                        <Building2 className="h-4 w-4 text-pink-500" />
                        الوحدة (AR)
                      </Label>
                      <Input
                        id="unit_ar"
                        {...register('unit_ar')}
                        className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-pink-400 transition-all"
                        dir="rtl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Notes Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={(currentGuestType === 'military' || (!currentGuestType && guest.guest_type === 'military')) ? '' : 'md:col-span-2'}
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/30 dark:via-yellow-950/30 dark:to-orange-950/30 backdrop-blur-sm h-full">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              <CardHeader className="relative z-10 border-b border-amber-200/50 dark:border-amber-800/50">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 rounded-lg bg-amber-500/10"
                    animate={{ rotate: [0, -360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <FileText className="h-5 w-5 text-amber-600" />
                  </motion.div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    ملاحظات
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4 text-amber-500" />
                    ملاحظات إضافية
                  </Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    rows={5}
                    className="bg-white/70 dark:bg-slate-800/70 border-2 hover:border-amber-400 transition-all resize-none"
                    placeholder="أضف أي ملاحظات إضافية..."
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Form Errors Summary */}
        {Object.keys(errors).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
          >
            <p className="font-semibold text-red-600 dark:text-red-400 mb-2">يرجى تصحيح الأخطاء التالية:</p>
            <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>{error?.message || `خطأ في ${field}`}</li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex gap-4 justify-end"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="border-2 hover:border-red-400 transition-all px-8"
          >
            <X className="ml-2 h-4 w-4" />
            إلغاء
          </Button>
          <Button 
            type="submit" 
            disabled={updateGuest.isPending || isSubmitting}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg px-8"
          >
            <Save className="ml-2 h-4 w-4" />
            {updateGuest.isPending || isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </motion.div>
      </form>
    </div>
  )
}
