'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useUnits, useDeleteUnit } from '@/lib/hooks/use-units'
import { useLocations } from '@/lib/hooks/use-locations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Plus, Search, Edit, Trash2, Home, MapPin, Users, Calendar } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function UnitsPage() {
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data: locations } = useLocations()
  const { data: units, isLoading } = useUnits({
    locationId: locationFilter !== 'all' ? locationFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  })
  const deleteUnit = useDeleteUnit()

  const filteredUnits = units?.filter(u =>
    u.unit_number.toLowerCase().includes(search.toLowerCase()) ||
    u.name_ar?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  )

  const typeLabels: Record<string, string> = {
    room: 'غرفة',
    suite: 'جناح',
    chalet: 'شاليه',
    duplex: 'دوبلكس',
    villa: 'فيلا',
    apartment: 'شقة',
  }

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    occupied: 'bg-blue-100 text-blue-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
    out_of_order: 'bg-red-100 text-red-800',
  }

  const statusLabels: Record<string, string> = {
    available: 'متاحة',
    occupied: 'مشغولة',
    maintenance: 'صيانة',
    out_of_order: 'خارج الخدمة',
  }

  async function handleDelete(id: string, unitNumber: string) {
    if (!confirm(`هل أنت متأكد من حذف الوحدة ${unitNumber}؟\n\n⚠️ تحذير: سيتم حذف الوحدة نهائياً من قاعدة البيانات مع جميع الصور والبيانات المرتبطة بها.\n\nهذا الإجراء لا يمكن التراجع عنه!`)) return

    try {
      await deleteUnit.mutateAsync(id)
      toast({
        title: 'نجح',
        description: `تم حذف الوحدة ${unitNumber} بنجاح`,
      })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف الوحدة',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Premium Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 shadow-2xl"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg"
              >
                <Home className="h-7 w-7 text-white" />
              </motion.div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                  الوحدات
                </h1>
                <p className="text-blue-100 text-lg font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse"></span>
                  إدارة جميع الوحدات والمنشآت
                </p>
              </div>
            </div>
            <Link href="/units/new">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button className="h-12 px-6 bg-white/20 hover:bg-white/30 text-white border-2 border-white/30 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all">
                  <Plus className="mr-2 h-5 w-5" />
                  وحدة جديدة
                </Button>
              </motion.div>
            </Link>
          </div>
        </motion.div>

        {/* Premium Filters Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="border-2 border-blue-200/50 dark:border-blue-800/50 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[250px]">
                  <div className="relative">
                    <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      placeholder="ابحث عن وحدة..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pr-12 h-12 bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-800 dark:to-blue-950/30 border-2 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all focus:border-blue-400 dark:focus:border-blue-600 text-base"
                    />
                  </div>
                </div>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-[200px] h-12 bg-gradient-to-br from-white to-purple-50/50 dark:from-slate-800 dark:to-purple-950/30 border-2 border-purple-200 dark:border-purple-800 shadow-lg hover:shadow-xl transition-all hover:border-purple-400 dark:hover:border-purple-600">
                    <SelectValue placeholder="الموقع" />
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
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[200px] h-12 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-800 dark:to-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 shadow-lg hover:shadow-xl transition-all hover:border-emerald-400 dark:hover:border-emerald-600">
                    <SelectValue placeholder="النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأنواع</SelectItem>
                    <SelectItem value="room">غرفة</SelectItem>
                    <SelectItem value="suite">جناح</SelectItem>
                    <SelectItem value="chalet">شاليه</SelectItem>
                    <SelectItem value="duplex">دوبلكس</SelectItem>
                    <SelectItem value="villa">فيلا</SelectItem>
                    <SelectItem value="apartment">شقة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Premium Units Grid */}
        {isLoading ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
              >
                <Skeleton className="h-96 rounded-2xl" />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredUnits?.map((unit, index) => {
              const primaryImage = unit.images?.find(img => img.is_primary) || unit.images?.[0]
              return (
                <motion.div
                  key={unit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ y: -8 }}
                  className="h-full"
                >
                  <Card className="h-full border-2 border-blue-200/50 dark:border-blue-800/50 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm group">
                    <div className="relative h-56 w-full overflow-hidden">
                      {primaryImage ? (
                        <Image
                          src={primaryImage.image_url}
                          alt={unit.name_ar || unit.name || ''}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                          <Home className="h-16 w-16 text-slate-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute top-3 right-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm shadow-lg ${statusColors[unit.status]}`}>
                          {statusLabels[unit.status]}
                        </span>
                      </div>
                    </div>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                        {unit.unit_number} - {unit.name_ar || unit.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-1">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{unit.location?.name_ar}</span>
                        <span className="mx-1">•</span>
                        <span>{typeLabels[unit.type]}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50">
                          <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">السعة:</span>
                          </div>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{unit.capacity} أشخاص</span>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Link href={`/units/${unit.id}`} className="flex-1">
                            <Button 
                              variant="outline" 
                              className="w-full h-11 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-lg hover:shadow-xl"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              تعديل
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            onClick={() => handleDelete(unit.id, unit.unit_number)}
                            disabled={deleteUnit.isPending}
                            className="h-11 px-4 text-destructive hover:text-destructive hover:bg-destructive/10 border-2 border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600 shadow-lg hover:shadow-xl transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
            {filteredUnits?.length === 0 && (
              <div className="col-span-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-16"
                >
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 mb-4">
                    <Home className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">لا توجد وحدات</h3>
                  <p className="text-slate-500 dark:text-slate-400">لم يتم العثور على وحدات تطابق معايير البحث</p>
                </motion.div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

