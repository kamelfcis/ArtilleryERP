'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit, Users, Calendar, Trash2, Phone, Mail, MapPin, Building2, User, Shield, Search, AlertTriangle, Briefcase } from 'lucide-react'
import { useLocations } from '@/lib/hooks/use-locations'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface StaffMember {
  id: string
  user_id?: string
  first_name: string
  last_name: string
  first_name_ar?: string
  last_name_ar?: string
  email?: string
  phone?: string
  position: string
  position_ar?: string
  department?: string
  department_ar?: string
  location_id?: string
  hire_date?: string
  is_active: boolean
  created_at: string
  location?: {
    id: string
    name: string
    name_ar: string
  }
}

export default function StaffPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: locations } = useLocations()

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select(`
          *,
          location:locations (id, name, name_ar)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as StaffMember[]
    },
  })

  // Delete staff mutation - also deletes from auth
  const deleteStaff = useMutation({
    mutationFn: async (staffMember: StaffMember) => {
      // Delete user from auth if exists
      if (staffMember.user_id) {
        const response = await fetch('/api/admin/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: staffMember.user_id }),
        })

        if (!response.ok) {
          const error = await response.json()
          console.error('Failed to delete auth user:', error)
          throw new Error(error.error || 'فشل في حذف حساب المستخدم من النظام')
        }
      }

      // Delete staff record
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffMember.id)

      if (error) throw error
    },
    onSuccess: (_, staffMember) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast({
        title: 'نجح',
        description: staffMember.user_id 
          ? 'تم حذف الموظف وحساب المستخدم بنجاح' 
          : 'تم حذف الموظف بنجاح',
      })
      setDeleteDialogOpen(false)
      setSelectedStaff(null)
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف الموظف',
        variant: 'destructive',
      })
    },
  })

  // Filter staff
  const filteredStaff = staff?.filter(member => {
    const matchesSearch = !search || 
      member.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      member.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      member.first_name_ar?.includes(search) ||
      member.last_name_ar?.includes(search) ||
      member.email?.toLowerCase().includes(search.toLowerCase()) ||
      member.phone?.includes(search)
    
    const matchesLocation = locationFilter === 'all' || member.location_id === locationFilter

    return matchesSearch && matchesLocation
  })

  const activeCount = staff?.filter(s => s.is_active).length || 0
  const totalCount = staff?.length || 0

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20">
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
                  إدارة الموظفين
                </h1>
                <p className="text-muted-foreground mt-1">إدارة الموظفين وحسابات النظام</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/staff/schedule">
                <Button variant="outline" className="border-2 hover:border-purple-400 transition-all">
                  <Calendar className="ml-2 h-4 w-4" />
                  الجدول الزمني
                </Button>
              </Link>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة موظف
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                      <User className="h-6 w-6 text-blue-600" />
                      إضافة موظف جديد
                    </DialogTitle>
                  </DialogHeader>
                  <StaffForm onSuccess={() => setDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
                    <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">الموظفين النشطين</p>
                    <p className="text-3xl font-bold text-green-600">{activeCount}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/10">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
              <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">المواقع</p>
                    <p className="text-3xl font-bold text-purple-600">{locations?.length || 0}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/10">
                    <MapPin className="h-6 w-6 text-purple-600" />
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
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="البحث بالاسم أو البريد أو الهاتف..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pr-10 border-2 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="w-[200px] border-2">
                      <SelectValue placeholder="جميع المواقع" />
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
              </CardContent>
            </Card>
          </motion.div>

          {/* Staff List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))}
                  </div>
                ) : filteredStaff && filteredStaff.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <AnimatePresence>
                      {filteredStaff.map((member, index) => (
                        <motion.div
                          key={member.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="flex-shrink-0">
                              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                {(member.first_name_ar || member.first_name)?.[0]}
                                {(member.last_name_ar || member.last_name)?.[0]}
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-lg">
                                  {member.first_name_ar || member.first_name} {member.last_name_ar || member.last_name}
                                </h3>
                                <Badge 
                                  variant={member.is_active ? 'default' : 'secondary'}
                                  className={cn(
                                    member.is_active 
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                      : 'bg-slate-100 text-slate-600'
                                  )}
                                >
                                  {member.is_active ? 'نشط' : 'غير نشط'}
                                </Badge>
                                {member.user_id && (
                                  <Badge variant="outline" className="border-blue-300 text-blue-600">
                                    <Shield className="h-3 w-3 ml-1" />
                                    حساب نظام
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3 w-3" />
                                  {member.position_ar || member.position}
                                </span>
                                {member.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {member.location.name_ar || member.location.name}
                                  </span>
                                )}
                                {member.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {member.phone}
                                  </span>
                                )}
                                {member.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {member.email}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStaff(member)
                                  setEditDialogOpen(true)
                                }}
                                className="border-2 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              >
                                <Edit className="ml-1 h-4 w-4" />
                                تعديل
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStaff(member)
                                  setDeleteDialogOpen(true)
                                }}
                                className="border-2 border-red-200 text-red-600 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="ml-1 h-4 w-4" />
                                حذف
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    </motion.div>
                    <p className="text-xl font-semibold text-muted-foreground">لا يوجد موظفين</p>
                    <p className="text-sm text-muted-foreground mt-1">أضف موظف جديد للبدء</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Edit className="h-6 w-6 text-blue-600" />
                  تعديل بيانات الموظف
                </DialogTitle>
              </DialogHeader>
              {selectedStaff && (
                <StaffForm 
                  staff={selectedStaff} 
                  onSuccess={() => {
                    setEditDialogOpen(false)
                    setSelectedStaff(null)
                  }} 
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <DialogTitle className="text-2xl font-bold text-center text-red-600">
                  تأكيد الحذف
                </DialogTitle>
                <DialogDescription className="text-center mt-4">
                  هل أنت متأكد من حذف الموظف{' '}
                  <span className="font-bold text-foreground">
                    {selectedStaff?.first_name_ar || selectedStaff?.first_name} {selectedStaff?.last_name_ar || selectedStaff?.last_name}
                  </span>
                  ؟
                </DialogDescription>
                {selectedStaff?.user_id && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      سيتم أيضاً حذف حساب المستخدم المرتبط من النظام
                    </p>
                  </div>
                )}
              </DialogHeader>
              <DialogFooter className="mt-6 gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  className="border-2"
                >
                  إلغاء
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => selectedStaff && deleteStaff.mutate(selectedStaff)}
                  disabled={deleteStaff.isPending}
                  className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
                >
                  {deleteStaff.isPending ? 'جاري الحذف...' : 'حذف نهائي'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </RoleGuard>
  )
}

function StaffForm({ staff, onSuccess }: { staff?: StaffMember; onSuccess?: () => void }) {
  const [firstName, setFirstName] = useState(staff?.first_name || '')
  const [lastName, setLastName] = useState(staff?.last_name || '')
  const [firstNameAr, setFirstNameAr] = useState(staff?.first_name_ar || '')
  const [lastNameAr, setLastNameAr] = useState(staff?.last_name_ar || '')
  const [email, setEmail] = useState(staff?.email || '')
  const [phone, setPhone] = useState(staff?.phone || '')
  const [position, setPosition] = useState(staff?.position || '')
  const [positionAr, setPositionAr] = useState(staff?.position_ar || '')
  const [locationId, setLocationId] = useState(staff?.location_id || '')
  const [isActive, setIsActive] = useState(staff?.is_active ?? true)
  const [password, setPassword] = useState('')
  const [createUserAccount, setCreateUserAccount] = useState(!staff)
  const { data: locations } = useLocations()
  const queryClient = useQueryClient()
  const isEdit = !!staff

  const saveStaff = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        // Update existing staff
        const { data, error } = await supabase
          .from('staff')
          .update({
            first_name: firstName,
            last_name: lastName,
            first_name_ar: firstNameAr,
            last_name_ar: lastNameAr,
            email,
            phone,
            position,
            position_ar: positionAr,
            location_id: locationId || null,
            is_active: isActive,
          })
          .eq('id', staff.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // Create new staff
        let userId: string | null = null

        // Create user account if requested
        if (createUserAccount && email && password) {
          const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password,
              role: 'Staff',
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'فشل في إنشاء حساب المستخدم')
          }

          const userData = await response.json()
          userId = userData.user?.id || null
        }

        const { data, error } = await supabase
          .from('staff')
          .insert({
            first_name: firstName,
            last_name: lastName,
            first_name_ar: firstNameAr,
            last_name_ar: lastNameAr,
            email,
            phone,
            position,
            position_ar: positionAr,
            location_id: locationId || null,
            user_id: userId,
            is_active: true,
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast({
        title: 'نجح',
        description: isEdit 
          ? 'تم تحديث بيانات الموظف بنجاح'
          : createUserAccount 
            ? 'تم إضافة الموظف وإنشاء حساب المستخدم بنجاح'
            : 'تم إضافة الموظف بنجاح',
      })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ الموظف',
        variant: 'destructive',
      })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        saveStaff.mutate()
      }}
      className="space-y-6"
    >
      {/* Name Fields */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
          <User className="h-4 w-4" />
          معلومات الاسم
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الاسم الأول (إنجليزي) *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="border-2" />
          </div>
          <div className="space-y-2">
            <Label>الاسم الأول (عربي) *</Label>
            <Input value={firstNameAr} onChange={(e) => setFirstNameAr(e.target.value)} required className="border-2" />
          </div>
          <div className="space-y-2">
            <Label>اسم العائلة (إنجليزي) *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="border-2" />
          </div>
          <div className="space-y-2">
            <Label>اسم العائلة (عربي) *</Label>
            <Input value={lastNameAr} onChange={(e) => setLastNameAr(e.target.value)} required className="border-2" />
          </div>
        </div>
      </div>

      {/* Contact Fields */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800">
        <h3 className="font-semibold text-green-700 dark:text-green-300 mb-4 flex items-center gap-2">
          <Phone className="h-4 w-4" />
          معلومات الاتصال
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border-2" />
          </div>
          <div className="space-y-2">
            <Label>الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="border-2" />
          </div>
        </div>
      </div>

      {/* Position Fields */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800">
        <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-4 flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          معلومات الوظيفة
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>المنصب (إنجليزي) *</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} required className="border-2" />
          </div>
          <div className="space-y-2">
            <Label>المنصب (عربي) *</Label>
            <Input value={positionAr} onChange={(e) => setPositionAr(e.target.value)} required className="border-2" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>الموقع *</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="border-2">
              <SelectValue placeholder="اختر الموقع" />
            </SelectTrigger>
            <SelectContent>
              {locations?.map(location => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isEdit && (
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is-active">موظف نشط</Label>
          </div>
        )}
      </div>

      {/* User Account Section - Only for new staff */}
      {!isEdit && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="create-user"
              checked={createUserAccount}
              onChange={(e) => setCreateUserAccount(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="create-user" className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              إنشاء حساب مستخدم للموظف (للدخول للنظام)
            </Label>
          </div>
          
          {createUserAccount && (
            <div className="space-y-4">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                سيتم إنشاء حساب مستخدم بدور "Staff" مرتبط بهذا الموظف. الموظف سيرى فقط بيانات الموقع الخاص به.
              </p>
              <div className="space-y-2">
                <Label>كلمة المرور *</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور للحساب"
                  required={createUserAccount}
                  minLength={6}
                  className="border-2"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg" 
        disabled={saveStaff.isPending || (!isEdit && createUserAccount && (!email || !password))}
      >
        {saveStaff.isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التغييرات' : 'إضافة الموظف'}
      </Button>
    </form>
  )
}
