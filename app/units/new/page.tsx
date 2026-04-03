'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { unitSchema, type UnitFormData } from '@/lib/validations/unit'
import { useCreateUnit } from '@/lib/hooks/use-units'
import { useLocations } from '@/lib/hooks/use-locations'
import { useFacilities } from '@/lib/hooks/use-facilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'
import Image from 'next/image'
import { X, ImageIcon, Home, Plus, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export default function NewUnitPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const createUnit = useCreateUnit()
  const { data: locations } = useLocations()
  const { data: facilities } = useFacilities()
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([])
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      status: 'available',
      capacity: 2,
      beds: 1,
      bathrooms: 1,
      is_active: true,
    },
  })

  async function onSubmit(data: UnitFormData) {
    try {
      const unit = await createUnit.mutateAsync(data)

      // Upload images directly to unit folder and save to database
      if (uploadedImages.length > 0) {
        for (let i = 0; i < uploadedImages.length; i++) {
          const image = uploadedImages[i]
          const file = image.file
          
          // Generate unique filename
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          // Path in unit folder: unit-{unit_id}/{filename}
          const filePath = `unit-${unit.id}/${fileName}`
          
          try {
            // Upload file directly to unit folder
            const { error: uploadError } = await supabase.storage
              .from('unit-images')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
              })
            
            if (!uploadError) {
              // Get public URL
              const { data: urlData } = supabase.storage
                .from('unit-images')
                .getPublicUrl(filePath)
              
              // Save to database
              const { error: imageError } = await supabase.from('unit_images').insert({
                unit_id: unit.id,
                image_url: urlData.publicUrl,
                image_path: filePath,
                is_primary: i === 0,
              })
              
              if (imageError) {
                console.error('Error inserting image:', imageError)
              }
            } else {
              console.error('Error uploading image to unit folder:', uploadError)
            }
          } catch (error) {
            console.error('Error processing image:', error)
          }
        }
      }

      // Link facilities
      if (selectedFacilities.length > 0) {
        const facilityLinks = selectedFacilities.map(facilityId => ({
          unit_id: unit.id,
          facility_id: facilityId,
        }))
        const { error: facilityError } = await supabase.from('unit_facilities').insert(facilityLinks)
        
        if (facilityError) {
          console.error('Error linking facilities:', facilityError)
          // Continue even if facilities fail
        }
      }

      // Refresh units list from database
      await queryClient.refetchQueries({ queryKey: ['units'] })
      
      toast({
        title: 'نجح',
        description: 'تم إنشاء الوحدة بنجاح',
      })
      router.push('/units')
    } catch (error: any) {
      console.error('Error creating unit:', error)
      
      let errorMessage = 'فشل في إنشاء الوحدة'
      if (error?.code === '23505' || error?.message?.includes('unique') || error?.message?.includes('duplicate')) {
        errorMessage = 'يوجد بالفعل وحدة بنفس الرقم في هذا الموقع. يرجى اختيار رقم آخر.'
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      toast({
        title: 'خطأ',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  function handleImageUpload(file: File) {
    const preview = URL.createObjectURL(file)
    setUploadedImages(prev => [...prev, { file, preview }])
  }

  function handleRemoveImage(index: number) {
    const imageToRemove = uploadedImages[index]
    // Revoke object URL to free memory
    URL.revokeObjectURL(imageToRemove.preview)
    
    // Remove from state
    setUploadedImages(uploadedImages.filter((_, i) => i !== index))
    
    toast({
      title: 'نجح',
      description: 'تم حذف الصورة',
    })
  }

  function handleSetPrimaryImage(index: number) {
    // Move selected image to first position
    const newImages = [...uploadedImages]
    const [selectedImage] = newImages.splice(index, 1)
    newImages.unshift(selectedImage)
    setUploadedImages(newImages)
    
    toast({
      title: 'نجح',
      description: 'تم تعيين الصورة كصورة رئيسية',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Premium Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-blue-50/50 to-purple-50/50 dark:from-slate-900 dark:via-blue-950/30 dark:to-purple-950/30 border-0 shadow-2xl backdrop-blur-xl p-8"
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
          <div className="relative z-10 flex items-center gap-4">
            <motion.div
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg"
            >
              <Home className="h-8 w-8 text-white" />
            </motion.div>
      <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                وحدة جديدة
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">إضافة وحدة جديدة للنظام</p>
            </div>
      </div>
        </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm">
              <CardHeader className="border-b border-blue-200/50 dark:border-blue-800/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                  معلومات الوحدة
                </CardTitle>
          </CardHeader>
              <CardContent className="space-y-6 p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location_id" className="text-base font-semibold">الموقع *</Label>
                <Select
                  onValueChange={(value) => setValue('location_id', value)}
                >
                  <SelectTrigger className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800">
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
                {errors.location_id && (
                  <p className="text-sm text-destructive font-medium">{errors.location_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_number" className="text-base font-semibold">رقم الوحدة *</Label>
                <Input
                  id="unit_number"
                  {...register('unit_number')}
                  className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  placeholder="أدخل رقم الوحدة"
                />
                {errors.unit_number && (
                  <p className="text-sm text-destructive font-medium">{errors.unit_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderno" className="text-base font-semibold">رقم الترتيب</Label>
                <Input
                  id="orderno"
                  type="number"
                  min="1"
                  {...register('orderno', { valueAsNumber: true })}
                  className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  placeholder="ترتيب العرض"
                />
              </div>
            </div>

              <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">الاسم</Label>
                <Input
                  id="name"
                  {...register('name')}
                className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                placeholder="أدخل اسم الوحدة"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-base font-semibold">النوع *</Label>
                <Select
                  onValueChange={(value) => setValue('type', value as any)}
                >
                  <SelectTrigger className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800">
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="room">غرفة</SelectItem>
                    <SelectItem value="suite">سويت</SelectItem>
                    <SelectItem value="chalet">شاليه</SelectItem>
                    <SelectItem value="duplex">دوبلكس</SelectItem>
                    <SelectItem value="villa">فيلا</SelectItem>
                    <SelectItem value="apartment">شقة</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-destructive font-medium">{errors.type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-base font-semibold">الحالة</Label>
                <Select
                  defaultValue="available"
                  onValueChange={(value) => setValue('status', value as any)}
                >
                  <SelectTrigger className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">متاحة</SelectItem>
                    <SelectItem value="occupied">مشغولة</SelectItem>
                    <SelectItem value="maintenance">صيانة</SelectItem>
                    <SelectItem value="out_of_order">خارج الخدمة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity" className="text-base font-semibold">السعة *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  {...register('capacity', { valueAsNumber: true })}
                  className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  placeholder="عدد الأشخاص"
                />
                {errors.capacity && (
                  <p className="text-sm text-destructive font-medium">{errors.capacity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="beds" className="text-base font-semibold">عدد الأسرة</Label>
                <Input
                  id="beds"
                  type="number"
                  min="1"
                  {...register('beds', { valueAsNumber: true })}
                  className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  placeholder="عدد الأسرة"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bathrooms" className="text-base font-semibold">عدد الحمامات</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min="1"
                  {...register('bathrooms', { valueAsNumber: true })}
                  className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  placeholder="عدد الحمامات"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="area_sqm" className="text-base font-semibold">المساحة (م²)</Label>
                <Input
                  id="area_sqm"
                  type="number"
                  step="0.01"
                  {...register('area_sqm', { valueAsNumber: true })}
                  className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  placeholder="المساحة بالمتر المربع"
                />
              </div>
            </div>

              <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">الوصف</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                rows={4}
                className="text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 resize-none"
                placeholder="أدخل وصف الوحدة..."
              />
            </div>
          </CardContent>
        </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 backdrop-blur-sm">
              <CardHeader className="border-b border-blue-200/50 dark:border-blue-800/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  >
                    <ImageIcon className="h-6 w-6 text-blue-600" />
                  </motion.div>
              الصور
            </CardTitle>
          </CardHeader>
              <CardContent className="space-y-4 p-6">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative overflow-hidden border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl p-12 text-center bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/30 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 hover:border-blue-400 dark:hover:border-blue-600 transition-all group"
            >
              <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                className="pointer-events-none"
              >
                <ImageIcon className="mx-auto h-16 w-16 text-blue-600 dark:text-blue-400 mb-4" />
              </motion.div>
              <div className="space-y-3 relative z-10">
                <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                  اضغط لرفع ملف أو اسحب الملف هنا
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg hover:shadow-xl transition-all relative z-20"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (fileInputRef.current) {
                      fileInputRef.current.click()
                    }
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  اختر ملف
                </Button>
                <input
                  ref={fileInputRef}
                  id="unit-image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = e.target.files
                    if (!files || files.length === 0) return
                    
                    const filesArray = Array.from(files)
                    
                    // Check file sizes (max 5MB)
                    const maxSize = 5 * 1024 * 1024
                    const oversizedFiles = filesArray.filter(file => file.size > maxSize)
                    if (oversizedFiles.length > 0) {
                      toast({
                        title: 'خطأ',
                        description: `بعض الملفات أكبر من 5 ميجابايت`,
                        variant: 'destructive',
                      })
                      return
                    }
                    
                    // Add files to state
                    filesArray.forEach(file => {
                      handleImageUpload(file)
                    })
                    
                    // Reset input
                    e.target.value = ''
                  }}
                />
              </div>
            </motion.div>
            
            {uploadedImages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    الصور المرفوعة ({uploadedImages.length})
                  </p>
                  {uploadedImages.length > 0 && (
                    <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                      الصورة الأولى ستكون الصورة الرئيسية
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {uploadedImages.map((image, index) => (
                    <div
                      key={index}
                      className="relative group border rounded-lg overflow-hidden aspect-square bg-muted"
                    >
                      <Image
                        src={image.preview}
                        alt={`صورة ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      
                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => handleRemoveImage(index)}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {index !== 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSetPrimaryImage(index)}
                            className="text-xs"
                          >
                            رئيسية
                          </Button>
                        )}
                      </div>
                      
                      {/* Primary badge */}
                      {index === 0 && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                          رئيسية
                        </div>
                      )}
                      
                      {/* Image number */}
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

          </motion.div>

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
            <div className="grid grid-cols-3 gap-4">
              {facilities?.map(facility => (
                <div key={facility.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`facility-${facility.id}`}
                    checked={selectedFacilities.includes(facility.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFacilities([...selectedFacilities, facility.id])
                      } else {
                        setSelectedFacilities(selectedFacilities.filter(id => id !== facility.id))
                      }
                    }}
                    className="rounded"
                  />
                  <label htmlFor={`facility-${facility.id}`} className="text-sm">
                    {facility.name_ar}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex gap-4 justify-end pt-6"
          >
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
              className="h-12 px-8 text-base border-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            إلغاء
          </Button>
            <Button
              type="submit"
              disabled={createUnit.isPending}
              className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {createUnit.isPending ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                  جاري الحفظ...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  حفظ الوحدة
                </span>
              )}
          </Button>
          </motion.div>
        </form>
        </div>
    </div>
  )
}

