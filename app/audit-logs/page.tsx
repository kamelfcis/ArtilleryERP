'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAuditLogs, useDeleteAuditLog, type AuditLog } from '@/lib/hooks/use-audit-logs'
import { useStaffList } from '@/lib/hooks/use-staff'
import { useUnits } from '@/lib/hooks/use-units'
import { useGuests } from '@/lib/hooks/use-guests'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/use-toast'
import { fetchWithSupabaseAuth } from '@/lib/api/fetch-with-supabase-auth'
import {
  Shield, User, Clock, FileText, Plus, Pencil, Trash2, Filter, Mail,
  Eye, ChevronLeft, ChevronRight, AlertTriangle, X, Loader2,
} from 'lucide-react'

const PAGE_SIZE = 20

/** Prefer audit_logs.user_id; fallback to created_by in row JSON when user_id was null (legacy triggers). */
function actorUserIdFromLog(log: AuditLog): string | undefined {
  if (log.user_id) return log.user_id
  const pick = (row: unknown): string | undefined => {
    if (!row || typeof row !== 'object') return undefined
    const o = row as Record<string, unknown>
    const v = o.created_by
    return typeof v === 'string' ? v : undefined
  }
  return pick(log.new_values) || pick(log.old_values)
}

export default function AuditLogsPage() {
  const { hasRole, elevatedOps } = useAuth()
  const isSuperAdmin = hasRole('SuperAdmin')
  const canDeleteAuditLogs = isSuperAdmin || elevatedOps
  const [resourceType, setResourceType] = useState<string>('all')
  const [action, setAction] = useState<string>('all')
  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [detailLog, setDetailLog] = useState<AuditLog | null>(null)
  const [deleteLog, setDeleteLog] = useState<AuditLog | null>(null)

  useEffect(() => { setCurrentPage(1) }, [resourceType, action, selectedUserId, dateFrom, dateTo])

  const { data: logs, isLoading } = useAuditLogs({
    resourceType: resourceType !== 'all' ? resourceType : undefined,
    action: action !== 'all' ? action : undefined,
    userId: selectedUserId !== 'all' ? selectedUserId : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 500,
  })

  const deleteAuditLog = useDeleteAuditLog()

  const { data: staffList } = useStaffList()

  const { data: authUsers, error: authUsersError } = useQuery({
    queryKey: ['auth-users-for-audit'],
    queryFn: async () => {
      const res = await fetchWithSupabaseAuth('/api/admin/users')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
      }
      const { users } = await res.json()
      return users as Array<{ id: string; email?: string }>
    },
    retry: 1,
  })

  useEffect(() => {
    if (authUsersError) {
      toast({
        title: 'تعذر تحميل أسماء المستخدمين',
        description: authUsersError instanceof Error ? authUsersError.message : 'تحقق من الجلسة أو إعدادات الخادم',
        variant: 'destructive',
      })
    }
  }, [authUsersError])

  const userInfoById = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>()
    if (authUsers) {
      for (const u of authUsers) {
        map.set(u.id, { name: u.email || '', email: u.email || '' })
      }
    }
    if (staffList) {
      for (const s of staffList) {
        if (s.user_id) {
          const existing = map.get(s.user_id)
          map.set(s.user_id, {
            name: `${s.first_name_ar || s.first_name} ${s.last_name_ar || s.last_name}`.trim(),
            email: s.email || existing?.email || '',
          })
        }
      }
    }
    return map
  }, [staffList, authUsers])

  const { data: unitsList } = useUnits()
  const { data: guestsList } = useGuests()

  const unitById = useMemo(() => {
    const map = new Map<string, string>()
    if (unitsList) {
      for (const u of unitsList) {
        const label = [u.unit_number ? `وحدة ${u.unit_number}` : '', u.name_ar || u.name || ''].filter(Boolean).join(' - ')
        map.set(u.id, label || u.id)
      }
    }
    return map
  }, [unitsList])

  const guestById = useMemo(() => {
    const map = new Map<string, string>()
    if (guestsList) {
      for (const g of guestsList) {
        const name = [g.first_name_ar || g.first_name, g.last_name_ar || g.last_name].filter(Boolean).join(' ')
        const label = [name, g.phone].filter(Boolean).join(' - ')
        map.set(g.id, label || g.id)
      }
    }
    return map
  }, [guestsList])

  const uniqueUserIds = useMemo(() => {
    if (!logs) return []
    const ids = new Set<string>()
    for (const log of logs) {
      const aid = actorUserIdFromLog(log)
      if (aid) ids.add(aid)
    }
    return Array.from(ids)
  }, [logs])

  /** User filter: all auth users + staff + any IDs seen in logs (so dropdown is never empty when users exist). */
  const userFilterOptions = useMemo(() => {
    const labelForId = (id: string) => {
      const info = userInfoById.get(id)
      if (info?.email && info?.name && info.name !== info.email) return `${info.name} (${info.email})`
      if (info?.email) return info.email
      if (info?.name) return info.name
      return `${id.slice(0, 8)}…`
    }
    const m = new Map<string, string>()
    if (authUsers) {
      for (const u of authUsers) {
        m.set(u.id, labelForId(u.id))
      }
    }
    if (staffList) {
      for (const s of staffList) {
        if (!s.user_id) continue
        const name = `${s.first_name_ar || s.first_name} ${s.last_name_ar || s.last_name}`.trim()
        const email = s.email || userInfoById.get(s.user_id)?.email || ''
        const fallback = labelForId(s.user_id)
        const label = name ? (email ? `${name} (${email})` : name) : fallback
        m.set(s.user_id, label)
      }
    }
    for (const uid of uniqueUserIds) {
      if (!m.has(uid)) m.set(uid, labelForId(uid))
    }
    return Array.from(m.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ar'))
  }, [authUsers, staffList, uniqueUserIds, userInfoById])

  const totalPages = logs ? Math.ceil(logs.length / PAGE_SIZE) : 0
  const paginatedLogs = useMemo(() => {
    if (!logs) return []
    const start = (currentPage - 1) * PAGE_SIZE
    return logs.slice(start, start + PAGE_SIZE)
  }, [logs, currentPage])

  const actionLabels: Record<string, string> = { INSERT: 'إنشاء', UPDATE: 'تحديث', DELETE: 'حذف' }
  const actionIcons: Record<string, typeof Plus> = { INSERT: Plus, UPDATE: Pencil, DELETE: Trash2 }
  const actionColors: Record<string, string> = {
    INSERT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  const resourceLabels: Record<string, string> = { reservations: 'حجوزات', units: 'وحدات', guests: 'ضيوف', pricing: 'أسعار' }
  const resourceColors: Record<string, string> = {
    reservations: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    units: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    guests: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    pricing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  }

  const fieldLabels: Record<string, string> = {
    id: 'المعرف', reservation_number: 'رقم الحجز', unit_id: 'الوحدة', guest_id: 'الضيف',
    check_in_date: 'تاريخ الدخول', check_out_date: 'تاريخ الخروج', status: 'الحالة', source: 'المصدر',
    total_amount: 'المبلغ الإجمالي', paid_amount: 'المبلغ المدفوع', discount_amount: 'الخصم',
    adults: 'بالغين', children: 'أطفال', notes: 'ملاحظات', notes_ar: 'ملاحظات (عربي)',
    created_by: 'أنشئ بواسطة', created_at: 'تاريخ الإنشاء', updated_at: 'تاريخ التحديث',
    unit_number: 'رقم الوحدة', name: 'الاسم', name_ar: 'الاسم (عربي)', type: 'النوع',
    beds: 'عدد الأسرة', floor: 'الطابق', is_active: 'نشط', location_id: 'معرف الموقع',
    first_name: 'الاسم الأول', last_name: 'الاسم الأخير', first_name_ar: 'الاسم الأول (عربي)',
    last_name_ar: 'الاسم الأخير (عربي)', email: 'البريد', phone: 'الهاتف', guest_type: 'نوع الضيف',
    price_per_night: 'السعر/ليلة', orderno: 'الترتيب', description: 'الوصف',
  }

  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار', confirmed: 'مؤكد', checked_in: 'تم الدخول',
    checked_out: 'تم الخروج', cancelled: 'ملغي', no_show: 'لم يحضر',
  }

  function getUserName(userId?: string): string {
    if (!userId) return 'غير معروف'
    const info = userInfoById.get(userId)
    if (!info) return userId.substring(0, 8) + '...'
    return info.name || info.email || userId.substring(0, 8) + '...'
  }

  function getUserEmail(userId?: string): string {
    if (!userId) return ''
    return userInfoById.get(userId)?.email || ''
  }

  function formatDateTime(date: string): string {
    return new Date(date).toLocaleString('ar-EG', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  function formatFieldValue(key: string, val: any): string {
    if (val === null || val === undefined) return '—'
    if (key === 'unit_id') return unitById.get(String(val)) || String(val)
    if (key === 'guest_id') return guestById.get(String(val)) || String(val)
    if (key === 'created_by') return getUserName(String(val))
    if (key === 'status') return statusLabels[val] || String(val)
    if (key === 'total_amount' || key === 'paid_amount' || key === 'discount_amount' || key === 'price_per_night') {
      return `${Number(val).toLocaleString('ar-EG')} ج.م`
    }
    if (key === 'is_active') return val ? 'نعم' : 'لا'
    if (key === 'created_at' || key === 'updated_at') {
      try { return formatDateTime(String(val)) } catch { return String(val) }
    }
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  function renderSummaryFields(values: any) {
    if (!values) return null
    const priorityKeys = ['reservation_number', 'status', 'check_in_date', 'check_out_date', 'total_amount', 'source', 'unit_number', 'name', 'name_ar', 'first_name', 'last_name', 'phone', 'email']
    const shown = priorityKeys.filter(k => values[k] !== undefined && values[k] !== null).slice(0, 4)
    if (shown.length === 0) return null
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {shown.map(k => (
          <span key={k} className="text-xs">
            <span className="text-muted-foreground">{fieldLabels[k] || k}: </span>
            <span className="font-medium">{formatFieldValue(k, values[k])}</span>
          </span>
        ))}
      </div>
    )
  }

  function handleDelete() {
    if (!deleteLog) return
    deleteAuditLog.mutate(deleteLog.id, {
      onSuccess: () => {
        toast({ title: 'تم الحذف', description: 'تم حذف السجل بنجاح' })
        setDeleteLog(null)
      },
      onError: (err: any) => {
        toast({ title: 'خطأ', description: err.message || 'فشل في حذف السجل', variant: 'destructive' })
      },
    })
  }

  function renderDetailSection(title: string, values: any) {
    if (!values || typeof values !== 'object') return null
    const entries = Object.entries(values)
    if (entries.length === 0) return null
    return (
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-foreground/80 mb-2 border-b pb-1">{title}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {entries.map(([key, val]) => (
            <div key={key} className="flex items-baseline gap-2 py-1.5 border-b border-dashed border-border/50 last:border-0">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[100px]">
                {fieldLabels[key] || key}
              </span>
              <span className="text-sm font-medium text-foreground break-all">
                {formatFieldValue(key, val)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function getRecordIdentity(log: AuditLog): { title: string; subtitle?: string } {
    const vals = log.new_values || log.old_values || {}
    if (log.resource_type === 'reservations') {
      const num = vals.reservation_number
      const status = vals.status ? (statusLabels[vals.status] || vals.status) : ''
      const guestName = vals.guest_id ? guestById.get(vals.guest_id) : undefined
      const unitName = vals.unit_id ? unitById.get(vals.unit_id) : undefined
      const subtitleParts = [guestName, unitName, status].filter(Boolean)
      return { title: num ? `حجز #${num}` : 'حجز', subtitle: subtitleParts.join(' | ') || undefined }
    }
    if (log.resource_type === 'units') {
      const num = vals.unit_number
      const name = vals.name_ar || vals.name
      return { title: num ? `وحدة ${num}` : 'وحدة', subtitle: name || undefined }
    }
    if (log.resource_type === 'guests') {
      const name = [vals.first_name_ar || vals.first_name, vals.last_name_ar || vals.last_name].filter(Boolean).join(' ')
      return { title: name || 'ضيف', subtitle: vals.phone || undefined }
    }
    if (log.resource_type === 'pricing') {
      return { title: 'تسعير', subtitle: vals.price_per_night ? `${Number(vals.price_per_night).toLocaleString('ar-EG')} ج.م/ليلة` : undefined }
    }
    return { title: resourceLabels[log.resource_type] || log.resource_type }
  }

  function getActionDescription(log: AuditLog): string {
    const userName = getUserName(actorUserIdFromLog(log))
    const identity = getRecordIdentity(log)
    if (log.action === 'INSERT') return `قام ${userName} بإنشاء ${identity.title}`
    if (log.action === 'UPDATE') return `قام ${userName} بتحديث ${identity.title}`
    if (log.action === 'DELETE') return `قام ${userName} بحذف ${identity.title}`
    return `${userName} - ${log.action}`
  }

  function getChangedFields(oldVals: any, newVals: any): Array<{ key: string; oldVal: any; newVal: any }> {
    if (!oldVals || !newVals) return []
    const skipKeys = ['updated_at']
    const changes: Array<{ key: string; oldVal: any; newVal: any }> = []
    const allKeys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)])
    for (const key of allKeys) {
      if (skipKeys.includes(key)) continue
      const ov = oldVals[key]
      const nv = newVals[key]
      if (JSON.stringify(ov) !== JSON.stringify(nv)) {
        changes.push({ key, oldVal: ov, newVal: nv })
      }
    }
    return changes
  }

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'Receptionist', 'Staff'] as any}>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <Shield className="h-7 w-7" />
              </div>
              سجل التدقيق
            </h1>
            <p className="text-muted-foreground">تتبع جميع التغييرات في النظام ومعرفة من قام بكل عملية</p>
          </div>
          {logs && (
            <div className="text-sm text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
              {logs.length} سجل
            </div>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              الفلاتر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">نوع المورد</Label>
                <Select value={resourceType} onValueChange={setResourceType}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الموارد</SelectItem>
                    <SelectItem value="reservations">حجوزات</SelectItem>
                    <SelectItem value="units">وحدات</SelectItem>
                    <SelectItem value="guests">ضيوف</SelectItem>
                    <SelectItem value="pricing">أسعار</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نوع العملية</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع العمليات</SelectItem>
                    <SelectItem value="INSERT">إنشاء</SelectItem>
                    <SelectItem value="UPDATE">تحديث</SelectItem>
                    <SelectItem value="DELETE">حذف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">المستخدم</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المستخدمين</SelectItem>
                    {userFilterOptions.map(({ id, label }) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">من تاريخ</Label>
                <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">إلى تاريخ</Label>
                <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Log Entries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              سجل التغييرات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 border rounded-xl">
                    <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16 rounded-md" />
                        <Skeleton className="h-5 w-14 rounded-md" />
                        <Skeleton className="h-5 w-20 rounded-md" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : paginatedLogs.length > 0 ? (
              <>
                <div className="space-y-2">
                  {paginatedLogs.map((log) => {
                    const ActionIcon = actionIcons[log.action] || FileText
                    const displayValues = log.action === 'DELETE' ? log.old_values : log.new_values
                    const actorId = actorUserIdFromLog(log)

                    return (
                      <div
                        key={log.id}
                        className="p-4 border rounded-xl hover:bg-accent/50 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${actionColors[log.action] || 'bg-secondary'}`}>
                            <ActionIcon className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${actionColors[log.action] || 'bg-secondary'}`}>
                                {actionLabels[log.action] || log.action}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${resourceColors[log.resource_type] || 'bg-secondary'}`}>
                                {resourceLabels[log.resource_type] || log.resource_type}
                              </span>
                              {displayValues?.reservation_number && (
                                <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  #{displayValues.reservation_number}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center flex-wrap gap-4 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1 font-medium text-foreground/80">
                                <User className="h-3 w-3" />
                                {getUserName(actorId)}
                              </span>
                              {getUserEmail(actorId) && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {getUserEmail(actorId)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDateTime(log.created_at)}
                              </span>
                            </div>

                            {renderSummaryFields(displayValues)}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              onClick={() => setDetailLog(log)}
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canDeleteAuditLogs && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setDeleteLog(log)}
                              title="حذف السجل"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      صفحة {currentPage} من {totalPages} ({logs?.length} سجل)
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="gap-1"
                      >
                        <ChevronRight className="h-4 w-4" />
                        السابق
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                          let page: number
                          if (totalPages <= 7) {
                            page = i + 1
                          } else if (currentPage <= 4) {
                            page = i + 1
                          } else if (currentPage >= totalPages - 3) {
                            page = totalPages - 6 + i
                          } else {
                            page = currentPage - 3 + i
                          }
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'ghost'}
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          )
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="gap-1"
                      >
                        التالي
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">لا توجد سجلات</p>
                <p className="text-sm">لم يتم العثور على أي سجلات تطابق الفلاتر المحددة</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(open) => { if (!open) setDetailLog(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden" dir="rtl">
          {detailLog && (() => {
            const ActionIcon = actionIcons[detailLog.action] || FileText
            const identity = getRecordIdentity(detailLog)
            const changedFields = detailLog.action === 'UPDATE' ? getChangedFields(detailLog.old_values, detailLog.new_values) : []
            return (
              <>
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-xl font-bold flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${actionColors[detailLog.action] || 'bg-secondary'}`}>
                      <ActionIcon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <span>{identity.title}</span>
                      {identity.subtitle && (
                        <span className="text-sm font-normal text-muted-foreground">{identity.subtitle}</span>
                      )}
                    </div>
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${actionColors[detailLog.action] || 'bg-secondary'}`}>
                          {actionLabels[detailLog.action] || detailLog.action}
                        </span>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${resourceColors[detailLog.resource_type] || 'bg-secondary'}`}>
                          {resourceLabels[detailLog.resource_type] || detailLog.resource_type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{getActionDescription(detailLog)}</p>
                    </div>
                  </DialogDescription>
                </DialogHeader>

                <div className="overflow-y-auto max-h-[60vh] space-y-5 py-4 px-1">
                  {/* Meta info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">المستخدم:</span>
                      <span className="font-semibold">{getUserName(actorUserIdFromLog(detailLog))}</span>
                    </div>
                    {getUserEmail(actorUserIdFromLog(detailLog)) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">البريد:</span>
                        <span className="font-medium">{getUserEmail(actorUserIdFromLog(detailLog))}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">التاريخ:</span>
                      <span className="font-medium">{formatDateTime(detailLog.created_at)}</span>
                    </div>
                    {detailLog.resource_id && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">المعرف:</span>
                        <span className="font-mono text-xs">{detailLog.resource_id}</span>
                      </div>
                    )}
                  </div>

                  {detailLog.action === 'UPDATE' ? (
                    <div className="space-y-4">
                      {changedFields.length > 0 && (
                        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 overflow-hidden">
                          <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 border-b border-amber-200 dark:border-amber-900/40">
                            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                              <Pencil className="h-4 w-4" />
                              التغييرات ({changedFields.length})
                            </h4>
                          </div>
                          <div className="divide-y divide-border/50">
                            {changedFields.map(({ key, oldVal, newVal }) => (
                              <div key={key} className="grid grid-cols-[minmax(100px,auto)_1fr_1fr] items-baseline gap-2 px-4 py-2.5 text-sm">
                                <span className="font-semibold text-muted-foreground text-xs">{fieldLabels[key] || key}</span>
                                <span className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded px-2 py-1 line-through break-all text-xs">
                                  {formatFieldValue(key, oldVal) || '—'}
                                </span>
                                <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded px-2 py-1 font-bold break-all text-xs">
                                  {formatFieldValue(key, newVal) || '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                          <ChevronLeft className="h-3 w-3 transition-transform group-open:-rotate-90" />
                          عرض جميع البيانات
                        </summary>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                          <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
                            {renderDetailSection('القيم القديمة', detailLog.old_values)}
                          </div>
                          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                            {renderDetailSection('القيم الجديدة', detailLog.new_values)}
                          </div>
                        </div>
                      </details>
                    </div>
                  ) : detailLog.action === 'DELETE' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40">
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-bold text-red-700 dark:text-red-300">تم حذف {identity.title}</span>
                      </div>
                      <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
                        {renderDetailSection('البيانات المحذوفة', detailLog.old_values)}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                        <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">تم إنشاء {identity.title}</span>
                      </div>
                      <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                        {renderDetailSection('البيانات الجديدة', detailLog.new_values)}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteLog} onOpenChange={(open) => { if (!open) setDeleteLog(null) }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3 text-red-600">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              تأكيد الحذف
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          {deleteLog && (
            <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1 my-2">
              <div><span className="text-muted-foreground">العملية: </span><span className="font-semibold">{actionLabels[deleteLog.action] || deleteLog.action}</span></div>
              <div><span className="text-muted-foreground">المورد: </span><span className="font-semibold">{resourceLabels[deleteLog.resource_type] || deleteLog.resource_type}</span></div>
              <div><span className="text-muted-foreground">التاريخ: </span><span className="font-medium">{formatDateTime(deleteLog.created_at)}</span></div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteLog(null)} disabled={deleteAuditLog.isPending}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteAuditLog.isPending}>
              {deleteAuditLog.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الحذف...</>
              ) : (
                <><Trash2 className="h-4 w-4 ml-2" />حذف</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}
