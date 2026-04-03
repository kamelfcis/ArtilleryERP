'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Utensils, Wrench, Search, Coffee, Pizza, Car, Sparkles, AlertTriangle, DollarSign, Package, Filter } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useServiceCategories, useServices, useUpdateService, useDeleteService, Service } from '@/lib/hooks/use-services'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { motion, AnimatePresence } from 'framer-motion'

export default function ServicesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'food' | 'service'>('all')
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const deleteService = useDeleteService()

  const { data: categories } = useServiceCategories()
  const { data: services, isLoading } = useServices({
    categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
    isFood: typeFilter === 'food' ? true : typeFilter === 'service' ? false : undefined,
  })

  // Filter services by search
  const filteredServices = services?.filter(service => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      service.name?.toLowerCase().includes(searchLower) ||
      service.name_ar?.includes(search) ||
      service.description_ar?.includes(search)
    )
  })

  // Stats
  const totalServices = services?.length || 0
  const foodCount = services?.filter(s => s.is_food).length || 0
  const serviceCount = services?.filter(s => !s.is_food).length || 0

  function handleEdit(service: Service) {
    setEditingService(service)
    setDialogOpen(true)
  }

  function handleDeleteClick(service: Service) {
    setServiceToDelete(service)
    setDeleteDialogOpen(true)
  }

  function confirmDelete() {
    if (!serviceToDelete) return

    deleteService.mutate(serviceToDelete.id, {
      onSuccess: () => {
        toast({
          title: 'نجح',
          description: 'تم حذف الخدمة بنجاح',
        })
        setDeleteDialogOpen(false)
        setServiceToDelete(null)
      },
      onError: (error: any) => {
        toast({
          title: 'خطأ',
          description: error.message || 'فشل في حذف الخدمة',
          variant: 'destructive',
        })
      },
    })
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      setDialogOpen(false)
      setEditingService(null)
    }
  }
  
  function handleAddNew() {
    setEditingService(null)
    setDialogOpen(true)
  }

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/30 dark:from-slate-950 dark:via-orange-950/20 dark:to-amber-950/20">
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
                className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 shadow-xl"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
              >
                <Utensils className="h-10 w-10 text-white" />
              </motion.div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
                  إدارة الخدمات والطعام
                </h1>
                <p className="text-muted-foreground mt-1">إدارة قائمة الطعام والخدمات المتاحة</p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <Button 
                onClick={handleAddNew}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-lg"
              >
                <Plus className="ml-2 h-4 w-4" />
                إضافة خدمة جديدة
              </Button>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent flex items-center gap-2">
                    {editingService ? (
                      <>
                        <Edit className="h-6 w-6 text-orange-600" />
                        تعديل الخدمة
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-6 w-6 text-orange-600" />
                        إضافة خدمة جديدة
                      </>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <ServiceForm 
                  service={editingService || undefined}
                  onSuccess={() => handleDialogClose(false)} 
                />
              </DialogContent>
            </Dialog>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
              <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الخدمات</p>
                    <p className="text-3xl font-bold text-orange-600">{totalServices}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-500/10">
                    <Package className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
              <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">الطعام</p>
                    <p className="text-3xl font-bold text-red-600">{foodCount}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/10">
                    <Pizza className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">الخدمات</p>
                    <p className="text-3xl font-bold text-blue-600">{serviceCount}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10">
                    <Wrench className="h-6 w-6 text-blue-600" />
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
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="البحث بالاسم أو الوصف..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pr-10 border-2 focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[180px] border-2">
                        <SelectValue placeholder="جميع الفئات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفئات</SelectItem>
                        {categories?.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name_ar}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={typeFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('all')}
                      className={cn(
                        "border-2",
                        typeFilter === 'all' && "bg-gradient-to-r from-orange-600 to-amber-600 border-transparent"
                      )}
                    >
                      الكل
                    </Button>
                    <Button
                      variant={typeFilter === 'food' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('food')}
                      className={cn(
                        "border-2 gap-1",
                        typeFilter === 'food' && "bg-gradient-to-r from-red-500 to-rose-500 border-transparent"
                      )}
                    >
                      <Pizza className="h-4 w-4" />
                      طعام
                    </Button>
                    <Button
                      variant={typeFilter === 'service' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('service')}
                      className={cn(
                        "border-2 gap-1",
                        typeFilter === 'service' && "bg-gradient-to-r from-blue-500 to-indigo-500 border-transparent"
                      )}
                    >
                      <Wrench className="h-4 w-4" />
                      خدمات
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Services Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            ) : filteredServices && filteredServices.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {filteredServices.map((service, index) => (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white dark:bg-slate-900">
                        {/* Gradient Top Bar */}
                        <div className={cn(
                          "h-2",
                          service.is_food 
                            ? "bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" 
                            : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                        )} />
                        
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2.5 rounded-xl",
                                service.is_food 
                                  ? "bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30" 
                                  : "bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30"
                              )}>
                                {service.is_food ? (
                                  <Utensils className="h-5 w-5 text-orange-600" />
                                ) : (
                                  <Wrench className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-bold text-lg">{service.name_ar || service.name}</h3>
                                {service.category && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    {service.category.name_ar}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "font-semibold",
                                service.is_food 
                                  ? "border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-950/30" 
                                  : "border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/30"
                              )}
                            >
                              {service.is_food ? 'طعام' : 'خدمة'}
                            </Badge>
                          </div>
                          
                          {service.description_ar && (
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                              {service.description_ar}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-5 w-5 text-green-600" />
                              <span className="text-xl font-bold text-green-600">
                                {formatCurrency(service.price)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                / {service.unit === 'piece' ? 'قطعة' : 
                                   service.unit === 'plate' ? 'طبق' : 
                                   service.unit === 'cup' ? 'كوب' : 
                                   service.unit === 'service' ? 'خدمة' : 
                                   service.unit === 'trip' ? 'رحلة' : 
                                   service.unit === 'hour' ? 'ساعة' : service.unit}
                              </span>
                            </div>
                            
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(service)}
                                className="h-9 w-9 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                              >
                                <Edit className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(service)}
                                className="h-9 w-9 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80">
                <CardContent className="py-16 text-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Coffee className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  </motion.div>
                  <p className="text-xl font-semibold text-muted-foreground">لا توجد خدمات</p>
                  <p className="text-sm text-muted-foreground mt-1">أضف خدمة جديدة للبدء</p>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Delete Confirmation Dialog */}
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
                  هل أنت متأكد من حذف{' '}
                  <span className="font-bold text-foreground">
                    {serviceToDelete?.name_ar || serviceToDelete?.name}
                  </span>
                  ؟
                </DialogDescription>
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
                  onClick={confirmDelete}
                  disabled={deleteService.isPending}
                  className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
                >
                  {deleteService.isPending ? 'جاري الحذف...' : 'حذف نهائي'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </RoleGuard>
  )
}

function ServiceForm({ 
  service, 
  onSuccess 
}: { 
  service?: Service
  onSuccess?: () => void 
}) {
  const isEditing = !!service
  const [name, setName] = useState(service?.name || '')
  const [nameAr, setNameAr] = useState(service?.name_ar || '')
  const [descriptionAr, setDescriptionAr] = useState(service?.description_ar || '')
  const [price, setPrice] = useState(service?.price?.toString() || '')
  const [unit, setUnit] = useState(service?.unit || 'piece')
  const [categoryId, setCategoryId] = useState(service?.category_id || '')
  const [isFood, setIsFood] = useState(service?.is_food || false)
  const { data: categories } = useServiceCategories()
  const queryClient = useQueryClient()
  const updateService = useUpdateService()

  // Reset form when service changes
  useEffect(() => {
    if (service) {
      setName(service.name || '')
      setNameAr(service.name_ar || '')
      setDescriptionAr(service.description_ar || '')
      setPrice(service.price?.toString() || '')
      setUnit(service.unit || 'piece')
      setCategoryId(service.category_id || '')
      setIsFood(service.is_food || false)
    } else {
      setName('')
      setNameAr('')
      setDescriptionAr('')
      setPrice('')
      setUnit('piece')
      setCategoryId('')
      setIsFood(false)
    }
  }, [service])

  const createService = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .insert({
          name,
          name_ar: nameAr,
          description_ar: descriptionAr,
          price: parseFloat(price),
          unit,
          category_id: categoryId && categoryId !== 'none' ? categoryId : undefined,
          is_food: isFood,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      toast({
        title: 'نجح',
        description: 'تم إضافة الخدمة بنجاح',
      })
      onSuccess?.()
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إضافة الخدمة',
        variant: 'destructive',
      })
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (isEditing && service) {
      updateService.mutate(
        {
          id: service.id,
          name,
          name_ar: nameAr,
          description_ar: descriptionAr,
          price: parseFloat(price),
          unit,
          category_id: categoryId && categoryId !== 'none' ? categoryId : undefined,
          is_food: isFood,
        },
        {
          onSuccess: () => {
            toast({
              title: 'نجح',
              description: 'تم تحديث الخدمة بنجاح',
            })
            onSuccess?.()
          },
          onError: (error: any) => {
            toast({
              title: 'خطأ',
              description: error.message || 'فشل في تحديث الخدمة',
              variant: 'destructive',
            })
          },
        }
      )
    } else {
      createService.mutate()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type Toggle */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              isFood 
                ? "bg-orange-100 dark:bg-orange-900/30" 
                : "bg-blue-100 dark:bg-blue-900/30"
            )}>
              {isFood ? (
                <Pizza className="h-5 w-5 text-orange-600" />
              ) : (
                <Wrench className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div>
              <Label className="font-semibold">نوع الخدمة</Label>
              <p className="text-sm text-muted-foreground">
                {isFood ? 'هذه الخدمة طعام أو مشروب' : 'هذه الخدمة عامة'}
              </p>
            </div>
          </div>
          <Switch
            checked={isFood}
            onCheckedChange={setIsFood}
          />
        </div>
      </div>

      {/* Name Fields */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800">
        <h3 className="font-semibold text-orange-700 dark:text-orange-300 mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          معلومات الخدمة
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>الاسم (إنجليزي) *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border-2"
              placeholder="Service name"
            />
          </div>
          <div className="space-y-2">
            <Label>الاسم (عربي) *</Label>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              required
              className="border-2"
              placeholder="اسم الخدمة"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>الوصف (عربي)</Label>
          <Textarea
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            className="border-2 min-h-[80px]"
            placeholder="وصف مختصر للخدمة..."
          />
        </div>
      </div>

      {/* Price & Unit */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800">
        <h3 className="font-semibold text-green-700 dark:text-green-300 mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          التسعير
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>السعر (جنيه مصري) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="border-2"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label>الوحدة *</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="piece">قطعة</SelectItem>
                <SelectItem value="plate">طبق</SelectItem>
                <SelectItem value="cup">كوب</SelectItem>
                <SelectItem value="service">خدمة</SelectItem>
                <SelectItem value="trip">رحلة</SelectItem>
                <SelectItem value="hour">ساعة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Category */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800">
        <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-4 flex items-center gap-2">
          <Package className="h-4 w-4" />
          التصنيف
        </h3>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="border-2">
            <SelectValue placeholder="اختر الفئة (اختياري)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">بدون فئة</SelectItem>
            {categories?.map(category => (
              <SelectItem key={category.id} value={category.id}>
                {category.name_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button 
        type="submit" 
        className="w-full h-12 text-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-lg" 
        disabled={createService.isPending || updateService.isPending}
      >
        {createService.isPending || updateService.isPending 
          ? 'جاري الحفظ...' 
          : isEditing 
          ? 'حفظ التغييرات' 
          : 'إضافة الخدمة'}
      </Button>
    </form>
  )
}
