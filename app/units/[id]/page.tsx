'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUnit } from '@/lib/hooks/use-units'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UNIT_TYPES, UNIT_STATUSES, UNIT_STATUS_COLORS } from '@/lib/constants'
import { Edit, ArrowLeft, Home, ChevronLeft, ChevronRight, Users, Bed, Bath, Maximize2, MapPin } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function UnitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: unit, isLoading } = useUnit(id)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20 p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-screen w-full" />
        </div>
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <p className="text-muted-foreground">الوحدة غير موجودة</p>
          </div>
        </div>
      </div>
    )
  }

  const allImages = unit.images || []
  const selectedImage = allImages[selectedImageIndex]

  function nextImage() {
    setSelectedImageIndex((prev) => (prev + 1) % allImages.length)
  }

  function prevImage() {
    setSelectedImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Premium Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-blue-50/50 to-purple-50/50 dark:from-slate-900 dark:via-blue-950/30 dark:to-purple-950/30 border-0 shadow-2xl backdrop-blur-xl p-6"
        >
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
          </div>
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/20 to-transparent"
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
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/units')}
                className="border-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                رجوع
              </Button>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {unit.unit_number} - {unit.name_ar || unit.name}
                </h1>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <MapPin className="h-4 w-4" />
                  <span>{unit.location?.name_ar}</span>
                </div>
              </div>
            </div>
            <Link href={`/units/${id}/edit`}>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all">
                <Edit className="mr-2 h-4 w-4" />
                تعديل
              </Button>
            </Link>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Premium Image Slider */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm">
              <CardHeader className="border-b border-blue-200/50 dark:border-blue-800/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Maximize2 className="h-6 w-6 text-blue-600" />
                  الصور
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {allImages.length > 0 ? (
                  <div className="space-y-4">
                    {/* Main Image Slider */}
                    <div className="relative group">
                      <div className="relative h-96 w-full rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={selectedImageIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                            className="relative w-full h-full"
                          >
                            <Image
                              src={selectedImage.image_url}
                              alt={`${unit.name_ar || unit.name} - صورة ${selectedImageIndex + 1}`}
                              fill
                              className="object-cover"
                              priority
                            />
                          </motion.div>
                        </AnimatePresence>
                        
                        {/* Navigation Arrows */}
                        {allImages.length > 1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={prevImage}
                              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <ChevronLeft className="h-6 w-6" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={nextImage}
                              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <ChevronRight className="h-6 w-6" />
                            </Button>
                          </>
                        )}

                        {/* Image Counter */}
                        {allImages.length > 1 && (
                          <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-semibold backdrop-blur-sm">
                            {selectedImageIndex + 1} / {allImages.length}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Thumbnails */}
                    {allImages.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {allImages.map((image, index) => (
                          <motion.button
                            key={image.id}
                            onClick={() => setSelectedImageIndex(index)}
                            className={cn(
                              "relative flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden border-2 transition-all",
                              selectedImageIndex === index
                                ? "border-blue-600 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800 scale-105"
                                : "border-transparent hover:border-blue-300 dark:hover:border-blue-700 opacity-70 hover:opacity-100"
                            )}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Image
                              src={image.image_url}
                              alt={`Thumbnail ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                            {selectedImageIndex === index && (
                              <div className="absolute inset-0 bg-blue-600/20 border-2 border-blue-600 dark:border-blue-400" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-96 w-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <Maximize2 className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                      <p className="text-slate-500 dark:text-slate-400">لا توجد صور</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Unit Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm">
              <CardHeader className="border-b border-blue-200/50 dark:border-blue-800/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Home className="h-6 w-6 text-blue-600" />
                  معلومات الوحدة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 p-3 rounded-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/50 dark:border-blue-800/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">رقم الوحدة</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{unit.unit_number}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-gradient-to-br from-purple-50/50 to-pink-50/30 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200/50 dark:border-purple-800/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">النوع</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{UNIT_TYPES[unit.type]}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/50 dark:border-emerald-800/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">الحالة</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${UNIT_STATUS_COLORS[unit.status]}`}>
                      {UNIT_STATUSES[unit.status]}
                    </span>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">السعة</span>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{unit.capacity} أشخاص</p>
                    </div>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-gradient-to-br from-rose-50/50 to-red-50/30 dark:from-rose-950/20 dark:to-red-950/20 border border-rose-200/50 dark:border-rose-800/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">عدد الأسرة</span>
                    <div className="flex items-center gap-2">
                      <Bed className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{unit.beds}</p>
                    </div>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-gradient-to-br from-cyan-50/50 to-blue-50/30 dark:from-cyan-950/20 dark:to-blue-950/20 border border-cyan-200/50 dark:border-cyan-800/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">عدد الحمامات</span>
                    <div className="flex items-center gap-2">
                      <Bath className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{unit.bathrooms}</p>
                    </div>
                  </div>
                </div>
                {unit.area_sqm && (
                  <div className="p-3 rounded-lg bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200/50 dark:border-violet-800/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">المساحة</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{unit.area_sqm} م²</p>
                  </div>
                )}
                {unit.description && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">الوصف:</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{unit.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Facilities */}
        {unit.facilities && unit.facilities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm">
              <CardHeader className="border-b border-blue-200/50 dark:border-blue-800/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  المرافق
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {unit.facilities.map((facilityLink: any, index: number) => {
                    const facility = facilityLink.facility
                    if (!facility) return null
                    return (
                      <motion.div
                        key={facility.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all"
                      >
                        {facility.icon && (
                          <span className="text-2xl">{facility.icon}</span>
                        )}
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{facility.name_ar}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}

