'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { guestSchema, type GuestFormData } from '@/lib/validations/guest'
import { useCreateGuest } from '@/lib/hooks/use-guests'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { DialogFooter } from '@/components/ui/dialog'
import { User, Phone, Mail, Shield, FileText, Sparkles, UserCircle, Users, Home, Heart } from 'lucide-react'

interface GuestFormProps {
  onSuccess?: (guest?: any) => void
  initialData?: Partial<GuestFormData>
}

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

// Guest type icons and colors
const GUEST_TYPE_CONFIG = {
  military: { icon: Shield, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'عسكري' },
  civilian: { icon: User, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'مدني' },
  club_member: { icon: Home, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'عضو دار' },
  artillery_family: { icon: Heart, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'ابناء مدفعية' },
}

export function GuestForm({ onSuccess, initialData }: GuestFormProps) {
  const createGuest = useCreateGuest()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<GuestFormData>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      guest_type: initialData?.guest_type || 'military',
      ...initialData,
    },
  })

  // Watch guest_type to show/hide military rank
  const currentGuestType = watch('guest_type')

  async function onSubmit(data: GuestFormData) {
    try {
      console.log('Submitting guest form with data:', data)
      const result = await createGuest.mutateAsync(data)
      console.log('Guest created successfully:', result)
      toast({
        title: 'نجح',
        description: 'تم إضافة الضيف بنجاح',
      })
      onSuccess?.(result)
    } catch (error: any) {
      console.error('Error creating guest from form:', error)
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إضافة الضيف',
        variant: 'destructive',
      })
    }
  }

  const currentTypeConfig = GUEST_TYPE_CONFIG[currentGuestType as keyof typeof GUEST_TYPE_CONFIG] || GUEST_TYPE_CONFIG.military
  const TypeIcon = currentTypeConfig.icon

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="first_name" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            الاسم الأول *
          </Label>
          <Input
            id="first_name"
            placeholder="أدخل الاسم الأول"
            className="h-12 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white/80 dark:bg-slate-900/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            {...register('first_name')}
          />
          {errors.first_name && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-500" />
              {errors.first_name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <UserCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            اسم العائلة *
          </Label>
          <Input
            id="last_name"
            placeholder="أدخل اسم العائلة"
            className="h-12 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white/80 dark:bg-slate-900/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            {...register('last_name')}
          />
          {errors.last_name && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-500" />
              {errors.last_name.message}
            </p>
          )}
        </div>
      </div>

      {/* Contact Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            رقم الهاتف *
          </Label>
          <Input
            id="phone"
            placeholder="أدخل رقم الهاتف"
            className="h-12 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white/80 dark:bg-slate-900/80 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
            {...register('phone')}
          />
          {errors.phone && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-500" />
              {errors.phone.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            البريد الإلكتروني
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="أدخل البريد الإلكتروني (اختياري)"
            className="h-12 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white/80 dark:bg-slate-900/80 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-500" />
              {errors.email.message}
            </p>
          )}
        </div>
      </div>

      {/* Guest Type */}
      <div className="space-y-3">
        <Label htmlFor="guest_type" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <div className={`p-1.5 rounded-lg ${currentTypeConfig.bg}`}>
            <TypeIcon className={`h-4 w-4 ${currentTypeConfig.color}`} />
          </div>
          نوع الضيف
        </Label>
        <Select
          value={currentGuestType || 'military'}
          onValueChange={(value) => {
            setValue('guest_type', value as any)
            // Clear military rank if not military
            if (value !== 'military') {
              setValue('military_rank_ar', '')
              setValue('military_rank', '')
            }
          }}
        >
          <SelectTrigger className="h-12 text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:border-blue-400 transition-all">
            <SelectValue placeholder="اختر نوع الضيف" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-2 shadow-xl">
            <SelectItem value="military" className="py-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Shield className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-medium">عسكري</span>
              </div>
            </SelectItem>
            <SelectItem value="civilian" className="py-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <User className="h-4 w-4 text-green-600" />
                </div>
                <span className="font-medium">مدني</span>
              </div>
            </SelectItem>
            <SelectItem value="club_member" className="py-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Home className="h-4 w-4 text-purple-600" />
                </div>
                <span className="font-medium">عضو دار</span>
              </div>
            </SelectItem>
            <SelectItem value="artillery_family" className="py-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Heart className="h-4 w-4 text-red-600" />
                </div>
                <span className="font-medium">ابناء مدفعية</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Military Rank - Only show for military type */}
      {currentGuestType === 'military' && (
        <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200/50 dark:border-blue-800/50">
          <Label htmlFor="military_rank_ar" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <div className="p-1.5 rounded-lg bg-blue-200 dark:bg-blue-800/50">
              <Shield className="h-4 w-4 text-blue-700 dark:text-blue-300" />
            </div>
            الرتبة العسكرية *
          </Label>
          <Select
            value={watch('military_rank_ar') || ''}
            onValueChange={(value) => {
              setValue('military_rank_ar', value)
              setValue('military_rank', value)
            }}
          >
            <SelectTrigger className="h-12 text-base border-2 border-blue-200 dark:border-blue-700 rounded-xl bg-white/90 dark:bg-slate-900/90 hover:border-blue-400 transition-all">
              <SelectValue placeholder="اختر الرتبة العسكرية" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-2 shadow-xl max-h-[300px]">
              {MILITARY_RANKS.map((rank) => (
                <SelectItem key={rank.value} value={rank.value} className="py-2.5 cursor-pointer">
                  <span className="font-medium">{rank.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" {...register('military_rank')} />
        </div>
      )}

      {/* Notes */}
      <div className="space-y-3">
        <Label htmlFor="notes" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
          ملاحظات
        </Label>
        <Textarea
          id="notes"
          placeholder="أدخل أي ملاحظات إضافية (اختياري)"
          className="min-h-[100px] text-base border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white/80 dark:bg-slate-900/80 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 transition-all resize-none"
          {...register('notes')}
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
        <Button 
          type="submit" 
          disabled={createGuest.isPending}
          className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {createGuest.isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              جاري الحفظ...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              حفظ الضيف
            </span>
          )}
        </Button>
      </div>
    </form>
  )
}

