'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  UserPlus,
  Crown,
  Fingerprint,
  Clock,
} from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface UserWithRoles {
  id: string
  email: string
  created_at?: string
  last_sign_in_at?: string
  roles: Array<{ role: { name: string } }>
}

const ROLE_CONFIG: Record<string, { color: string; icon: any; gradient: string }> = {
  SuperAdmin: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    icon: Crown,
    gradient: 'from-red-500 to-rose-500',
  },
  BranchManager: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    icon: ShieldCheck,
    gradient: 'from-blue-500 to-indigo-500',
  },
  Receptionist: {
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    icon: UserCog,
    gradient: 'from-emerald-500 to-teal-500',
  },
  Staff: {
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    icon: Shield,
    gradient: 'from-amber-500 to-orange-500',
  },
}

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  // Fetch all users from auth using API route with Service Role Key
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        throw new Error('فشل في جلب المستخدمين')
      }
      const { users: authUsers } = await response.json()

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role:roles (
            name
          )
        `)

      if (rolesError) throw rolesError

      const usersWithRoles = authUsers.map((authUser: any) => {
        const userRolesForUser = (userRoles || []).filter((ur: any) => ur.user_id === authUser.id)
        return {
          id: authUser.id,
          email: authUser.email || 'N/A',
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at,
          roles: userRolesForUser,
        }
      })

      return usersWithRoles as UserWithRoles[]
    },
  })

  const filteredUsers = useMemo(() => {
    return users?.filter(u => {
      const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === 'all' || u.roles.some((r: any) => r.role.name === roleFilter)
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const stats = useMemo(() => {
    if (!users) return { total: 0, admins: 0, managers: 0, staff: 0, noRole: 0 }
    return {
      total: users.length,
      admins: users.filter(u => u.roles.some((r: any) => r.role.name === 'SuperAdmin')).length,
      managers: users.filter(u => u.roles.some((r: any) => r.role.name === 'BranchManager')).length,
      staff: users.filter(u => u.roles.some((r: any) => ['Receptionist', 'Staff'].includes(r.role.name))).length,
      noRole: users.filter(u => u.roles.length === 0).length,
    }
  }, [users])

  return (
    <RoleGuard allowedRoles={['SuperAdmin']}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-violet-400/10 to-fuchsia-400/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative z-10 p-6 space-y-6 max-w-7xl mx-auto">
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
                className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-violet-900 dark:from-slate-100 dark:via-blue-200 dark:to-violet-200 bg-clip-text text-transparent"
              >
                إدارة المستخدمين
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground flex items-center gap-2 mt-1"
              >
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                </motion.span>
                إدارة المستخدمين والصلاحيات والأدوار
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button className="h-12 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25 text-white gap-2">
                      <UserPlus className="h-5 w-5" />
                      مستخدم جديد
                    </Button>
                  </motion.div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-blue-600" />
                      إضافة مستخدم جديد
                    </DialogTitle>
                  </DialogHeader>
                  <UserForm onSuccess={() => setDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </motion.div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-4"
          >
            {[
              { label: 'إجمالي المستخدمين', value: stats.total, icon: Users, color: 'from-blue-500 to-indigo-500', bgColor: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20' },
              { label: 'مديرين عامين', value: stats.admins, icon: Crown, color: 'from-red-500 to-rose-500', bgColor: 'from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20' },
              { label: 'مديرين فروع', value: stats.managers, icon: ShieldCheck, color: 'from-violet-500 to-purple-500', bgColor: 'from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20' },
              { label: 'موظفين', value: stats.staff, icon: Shield, color: 'from-emerald-500 to-teal-500', bgColor: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20' },
              { label: 'بدون دور', value: stats.noRole, icon: ShieldAlert, color: 'from-amber-500 to-orange-500', bgColor: 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20' },
            ].map((stat, index) => {
              const StatIcon = stat.icon
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  whileHover={{ scale: 1.03, y: -3 }}
                >
                  <Card className={cn(
                    'border-0 shadow-lg bg-gradient-to-br backdrop-blur-xl overflow-hidden relative',
                    stat.bgColor
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                          <p className={cn('text-3xl font-black mt-1 bg-gradient-to-r bg-clip-text text-transparent', stat.color)}>
                            {stat.value}
                          </p>
                        </div>
                        <div className={cn('p-2.5 rounded-xl bg-gradient-to-br opacity-80', stat.color)}>
                          <StatIcon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Search & Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="ابحث بالبريد الإلكتروني..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pr-10 h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-blue-400 focus:border-blue-500 rounded-xl transition-all"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2"
                      >
                        <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                      </button>
                    )}
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-48 h-12 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-2 hover:border-blue-400 rounded-xl transition-all">
                      <SelectValue placeholder="فلتر حسب الدور" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأدوار</SelectItem>
                      <SelectItem value="SuperAdmin">مدير عام</SelectItem>
                      <SelectItem value="BranchManager">مدير فرع</SelectItem>
                      <SelectItem value="Receptionist">موظف استقبال</SelectItem>
                      <SelectItem value="Staff">موظف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Users List */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="border-0 shadow-lg bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-14 w-14 rounded-2xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {filteredUsers && filteredUsers.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                      {filteredUsers.map((user, index) => (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.03 }}
                          layout
                        >
                          <UserCard user={user} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
                      <CardContent className="py-16 text-center">
                        <motion.div
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Users className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        </motion.div>
                        <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">لا يوجد مستخدمين</p>
                        <p className="text-sm text-slate-400 mt-1">جرب البحث بكلمات مختلفة أو تغيير الفلتر</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {filteredUsers && filteredUsers.length > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-slate-400 text-center mt-4"
                  >
                    عرض {filteredUsers.length} من {users?.length || 0} مستخدم
                  </motion.p>
                )}
              </>
            )}
          </motion.div>
        </div>
      </div>
    </RoleGuard>
  )
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({ user }: { user: UserWithRoles }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const queryClient = useQueryClient()

  const primaryRole = user.roles[0]?.role?.name || null
  const roleConfig = primaryRole ? ROLE_CONFIG[primaryRole] : null
  const RoleIcon = roleConfig?.icon || Shield

  const initials = user.email
    .split('@')[0]
    .substring(0, 2)
    .toUpperCase()

  const createdDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'لم يسجل دخول بعد'

  async function handleDelete() {
    try {
      setIsDeleting(true)
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      toast({
        title: '✅ تم الحذف',
        description: 'تم حذف المستخدم بنجاح',
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteDialogOpen(false)
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف المستخدم',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card className="relative overflow-hidden border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl hover:shadow-2xl transition-all duration-300 group">
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          animate={{ x: ['-200%', '200%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 4 }}
        />
        {/* Top accent bar */}
        <div className={cn(
          'h-1 bg-gradient-to-r',
          roleConfig ? roleConfig.gradient : 'from-slate-300 to-slate-400'
        )} />

        <CardContent className="relative z-10 p-5">
          {/* User Info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <motion.div
              className={cn(
                'h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0 bg-gradient-to-br',
                roleConfig ? roleConfig.gradient : 'from-slate-400 to-slate-500'
              )}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {initials}
            </motion.div>

            <div className="flex-1 min-w-0">
              {/* Email */}
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">
                  {user.email}
                </p>
              </div>

              {/* Roles */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {user.roles.length > 0 ? (
                  user.roles.map((ur: any, index: number) => {
                    const config = ROLE_CONFIG[ur.role.name]
                    const Icon = config?.icon || Shield
                    return (
                      <Badge
                        key={index}
                        variant="outline"
                        className={cn('text-[10px] font-bold gap-1 px-2 py-0.5', config?.color)}
                      >
                        <Icon className="h-3 w-3" />
                        {ur.role.name === 'SuperAdmin' ? 'مدير عام' :
                          ur.role.name === 'BranchManager' ? 'مدير فرع' :
                            ur.role.name === 'Receptionist' ? 'موظف استقبال' :
                              ur.role.name === 'Staff' ? 'موظف' : ur.role.name}
                      </Badge>
                    )
                  })
                ) : (
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-dashed">
                    <ShieldAlert className="h-3 w-3 ml-1" />
                    بدون دور
                  </Badge>
                )}
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-400">
                {createdDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {createdDate}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Fingerprint className="h-3 w-3" />
                  {user.id.substring(0, 8)}...
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Edit User */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-9 rounded-lg border-2 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all gap-1.5 text-xs"
                  >
                    <Edit className="h-3.5 w-3.5 text-blue-500" />
                    تعديل
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                    <Edit className="h-5 w-5 text-blue-600" />
                    تعديل المستخدم
                  </DialogTitle>
                  <DialogDescription className="text-sm text-slate-500">
                    {user.email}
                  </DialogDescription>
                </DialogHeader>
                <EditUserForm userId={user.id} currentEmail={user.email} onSuccess={() => setEditDialogOpen(false)} />
              </DialogContent>
            </Dialog>

            {/* Edit Roles */}
            <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-9 rounded-lg border-2 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all gap-1.5 text-xs"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-violet-500" />
                    الأدوار
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-violet-600" />
                    إدارة الأدوار
                  </DialogTitle>
                  <DialogDescription className="text-sm text-slate-500">
                    {user.email}
                  </DialogDescription>
                </DialogHeader>
                <UserRoleForm
                  userId={user.id}
                  currentRoles={user.roles.map((ur: any) => ur.role.name)}
                  onSuccess={() => setRoleDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>

            {/* Delete */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 rounded-lg border-2 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    تأكيد حذف المستخدم
                  </DialogTitle>
                  <DialogDescription className="text-sm text-slate-500 pt-2">
                    هل أنت متأكد من حذف المستخدم <strong className="text-slate-700 dark:text-slate-300">{user.email}</strong>؟
                    <br />
                    <span className="text-red-500">هذا الإجراء لا يمكن التراجع عنه.</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 mt-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br',
                      roleConfig ? roleConfig.gradient : 'from-slate-400 to-slate-500'
                    )}>
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{user.email}</p>
                      <div className="flex gap-1 mt-1">
                        {user.roles.map((ur: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{ur.role.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="mt-4 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                    className="rounded-xl"
                    disabled={isDeleting}
                  >
                    إلغاء
                  </Button>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/25 gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          جاري الحذف...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          حذف المستخدم
                        </>
                      )}
                    </Button>
                  </motion.div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ─── Create User Form ─────────────────────────────────────────────────────────

function UserForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: role || undefined }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      toast({
        title: '✅ تم بنجاح',
        description: 'تم إنشاء المستخدم بنجاح',
      })

      queryClient.invalidateQueries({ queryKey: ['users'] })
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء المستخدم',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-500" />
          البريد الإلكتروني <span className="text-red-400">*</span>
        </Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="user@example.com"
          className="h-12 bg-white/70 dark:bg-slate-800/70 border-2 hover:border-blue-400 focus:border-blue-500 rounded-xl transition-all"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 text-blue-500" />
          كلمة المرور <span className="text-red-400">*</span>
        </Label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="••••••••"
            className="h-12 bg-white/70 dark:bg-slate-800/70 border-2 hover:border-blue-400 focus:border-blue-500 rounded-xl transition-all pl-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-violet-500" />
          الدور
        </Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-12 bg-white/70 dark:bg-slate-800/70 border-2 hover:border-violet-400 rounded-xl transition-all">
            <SelectValue placeholder="اختر الدور (اختياري)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SuperAdmin">
              <span className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-red-500" /> مدير عام
              </span>
            </SelectItem>
            <SelectItem value="BranchManager">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-500" /> مدير فرع
              </span>
            </SelectItem>
            <SelectItem value="Receptionist">
              <span className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-emerald-500" /> موظف استقبال
              </span>
            </SelectItem>
            <SelectItem value="Staff">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-500" /> موظف
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25 text-white"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الإنشاء...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              إنشاء المستخدم
            </span>
          )}
        </Button>
      </motion.div>
    </form>
  )
}

// ─── Edit User Form ───────────────────────────────────────────────────────────

function EditUserForm({
  userId,
  currentEmail,
  onSuccess,
}: {
  userId: string
  currentEmail: string
  onSuccess?: () => void
}) {
  const [email, setEmail] = useState(currentEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const body: any = { userId }
      if (email !== currentEmail) body.email = email
      if (password) body.password = password

      if (!body.email && !body.password) {
        toast({
          title: 'تنبيه',
          description: 'لم يتم تغيير أي بيانات',
        })
        setIsSubmitting(false)
        return
      }

      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      toast({
        title: '✅ تم التحديث',
        description: 'تم تحديث بيانات المستخدم بنجاح',
      })

      queryClient.invalidateQueries({ queryKey: ['users'] })
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث المستخدم',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-500" />
          البريد الإلكتروني
        </Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="h-12 bg-white/70 dark:bg-slate-800/70 border-2 hover:border-blue-400 focus:border-blue-500 rounded-xl transition-all"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 text-blue-500" />
          كلمة مرور جديدة <span className="text-xs text-slate-400">(اتركها فارغة إذا لا تريد التغيير)</span>
        </Label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            placeholder="••••••••"
            className="h-12 bg-white/70 dark:bg-slate-800/70 border-2 hover:border-blue-400 focus:border-blue-500 rounded-xl transition-all pl-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 text-white"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحديث...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              حفظ التغييرات
            </span>
          )}
        </Button>
      </motion.div>
    </form>
  )
}

// ─── User Role Form ───────────────────────────────────────────────────────────

function UserRoleForm({
  userId,
  currentRoles,
  onSuccess,
}: {
  userId: string
  currentRoles: string[]
  onSuccess?: () => void
}) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(currentRoles)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (error) throw error
      return data
    },
  })

  function toggleRole(roleName: string) {
    setSelectedRoles(prev =>
      prev.includes(roleName)
        ? prev.filter(r => r !== roleName)
        : [...prev, roleName]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Remove all existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      // Add new roles
      if (selectedRoles.length > 0) {
        const roleIds = await Promise.all(
          selectedRoles.map(async (roleName) => {
            const role = roles?.find((r: any) => r.name === roleName)
            return role?.id
          })
        )

        const validRoleIds = roleIds.filter(Boolean)

        if (validRoleIds.length > 0) {
          const userRoles = validRoleIds.map(roleId => ({
            user_id: userId,
            role_id: roleId,
          }))

          const { error } = await supabase
            .from('user_roles')
            .insert(userRoles)

          if (error) throw error
        }
      }

      toast({
        title: '✅ تم التحديث',
        description: 'تم تحديث الأدوار بنجاح',
      })

      queryClient.invalidateQueries({ queryKey: ['users'] })
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث الأدوار',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleDisplayMap: Record<string, { label: string; description: string; icon: any; gradient: string }> = {
    SuperAdmin: { label: 'مدير عام', description: 'صلاحيات كاملة على النظام', icon: Crown, gradient: 'from-red-500 to-rose-500' },
    BranchManager: { label: 'مدير فرع', description: 'إدارة فرع محدد', icon: ShieldCheck, gradient: 'from-blue-500 to-indigo-500' },
    Receptionist: { label: 'موظف استقبال', description: 'إدارة الحجوزات والضيوف', icon: UserCog, gradient: 'from-emerald-500 to-teal-500' },
    Staff: { label: 'موظف', description: 'عرض البيانات الأساسية', icon: Shield, gradient: 'from-amber-500 to-orange-500' },
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-3">
        {roles?.map((role: any) => {
          const display = roleDisplayMap[role.name]
          const isSelected = selectedRoles.includes(role.name)
          const RoleIcon = display?.icon || Shield

          return (
            <motion.button
              key={role.id}
              type="button"
              onClick={() => toggleRole(role.name)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-right',
                isSelected
                  ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/20 shadow-lg shadow-violet-500/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white/50 dark:bg-slate-800/50'
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition-all',
                isSelected
                  ? `bg-gradient-to-br ${display?.gradient || 'from-slate-400 to-slate-500'}`
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              )}>
                <RoleIcon className={cn('h-5 w-5', !isSelected && 'text-slate-500 dark:text-slate-400')} />
              </div>
              <div className="flex-1">
                <p className={cn(
                  'font-bold text-sm',
                  isSelected ? 'text-violet-700 dark:text-violet-400' : 'text-slate-700 dark:text-slate-300'
                )}>
                  {display?.label || role.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {display?.description || role.description || ''}
                </p>
              </div>
              <div className={cn(
                'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all',
                isSelected
                  ? 'border-violet-500 bg-violet-500'
                  : 'border-slate-300 dark:border-slate-600'
              )}>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
              </div>
            </motion.button>
          )
        })}
      </div>

      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25 text-white"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              حفظ الأدوار
            </span>
          )}
        </Button>
      </motion.div>
    </form>
  )
}
