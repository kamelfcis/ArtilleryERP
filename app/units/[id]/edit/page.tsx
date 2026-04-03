'use client'

import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { unitSchema, type UnitFormData } from '@/lib/validations/unit'
import { useUnit, useUpdateUnit } from '@/lib/hooks/use-units'
import { useLocations } from '@/lib/hooks/use-locations'
import { useFacilities } from '@/lib/hooks/use-facilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { X, ImageIcon, Home, Plus, Sparkles, Edit } from 'lucide-react'
import { motion } from 'framer-motion'

export default function EditUnitPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string
  const { data: unit, isLoading } = useUnit(id)
  const updateUnit = useUpdateUnit()
  const { data: locations } = useLocations()
  const { data: facilities } = useFacilities()
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([])
  const [existingImages, setExistingImages] = useState<Array<{ id: string; url: string; path: string; is_primary: boolean }>>([])
  const [newImages, setNewImages] = useState<Array<{ file: File; preview: string }>>([])
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
  })

  useEffect(() => {
    if (unit) {
      reset({
        location_id: unit.location_id || '',
        unit_number: unit.unit_number || '',
        name: unit.name || '',
        name_ar: unit.name_ar || '',
        type: unit.type || 'room',
        status: unit.status || 'available',
        capacity: unit.capacity || 1,
        beds: unit.beds || 1,
        bathrooms: unit.bathrooms || 1,
        area_sqm: unit.area_sqm || undefined,
        orderno: (unit as any).orderno || undefined,
        description: unit.description || '',
        description_ar: unit.description_ar || '',
        is_active: unit.is_active ?? true,
      })
      if (unit.facilities) {
        setSelectedFacilities(
          unit.facilities.map((f: any) => f.facility?.id).filter(Boolean)
        )
      }
      // Load existing images
      if (unit.images) {
        setExistingImages(
          unit.images.map((img: any) => ({
            id: img.id,
            url: img.image_url,
            path: img.image_path,
            is_primary: img.is_primary,
          }))
        )
      }
    }
  }, [unit, reset])

  async function onSubmit(data: UnitFormData) {
    try {
      // Validate required fields
      if (!data.location_id || !data.unit_number || !data.type) {
        toast({
          title: 'خطأ',
          description: 'يرجى ملء جميع الحقول المطلوبة',
          variant: 'destructive',
        })
        return
      }
      
      // Ensure all required fields are present and valid
      const updateData: any = {
        location_id: String(data.location_id).trim(),
        unit_number: String(data.unit_number).trim(),
        type: data.type,
        status: data.status || 'available',
        capacity: Number(data.capacity) || 1,
        beds: Number(data.beds) || 1,
        bathrooms: Number(data.bathrooms) || 1,
        is_active: data.is_active ?? true,
      }
      
      // Optional fields - only include if they have values
      if (data.name && data.name.trim()) updateData.name = data.name.trim()
      if (data.name_ar && data.name_ar.trim()) updateData.name_ar = data.name_ar.trim()
      if (data.area_sqm && Number(data.area_sqm) > 0) updateData.area_sqm = Number(data.area_sqm)
      if (data.orderno && Number(data.orderno) > 0) updateData.orderno = Number(data.orderno)
      if (data.description && data.description.trim()) updateData.description = data.description.trim()
      if (data.description_ar && data.description_ar.trim()) updateData.description_ar = data.description_ar.trim()
      
      await updateUnit.mutateAsync({
        id,
        ...updateData,
      })

      // Update facilities
      await supabase
        .from('unit_facilities')
        .delete()
        .eq('unit_id', id)

      if (selectedFacilities.length > 0) {
        const facilityLinks = selectedFacilities.map(facilityId => ({
          unit_id: id,
          facility_id: facilityId,
        }))
        await supabase.from('unit_facilities').insert(facilityLinks)
      }

      // Delete removed images from storage and database
      if (deletedImageIds.length > 0) {
        // Get image paths before deleting from database
        const { data: imagesToDelete } = await supabase
          .from('unit_images')
          .select('image_path')
          .in('id', deletedImageIds)

        if (imagesToDelete && imagesToDelete.length > 0) {
          const imagePaths = imagesToDelete.map(img => img.image_path)
          // Delete from storage
          await supabase.storage
            .from('unit-images')
            .remove(imagePaths)
            .catch(err => console.error('Error deleting images from storage:', err))
        }

        // Delete from database
        await supabase
          .from('unit_images')
          .delete()
          .in('id', deletedImageIds)
      }

      // Upload new images to unit folder
      if (newImages.length > 0) {
        const remainingExistingImages = existingImages.filter(img => !deletedImageIds.includes(img.id))
        const isFirstImage = remainingExistingImages.length === 0

        for (let i = 0; i < newImages.length; i++) {
          const image = newImages[i]
          const file = image.file
          
          // Generate unique filename
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          const filePath = `unit-${id}/${fileName}`
          
          try {
            // Upload file to unit folder
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
              await supabase.from('unit_images').insert({
                unit_id: id,
                image_url: urlData.publicUrl,
                image_path: filePath,
                is_primary: isFirstImage && i === 0,
              })
            } else {
              console.error('Error uploading image:', uploadError)
            }
          } catch (error) {
            console.error('Error processing image:', error)
          }
        }
      }

      // Refresh units list from database
      await queryClient.refetchQueries({ queryKey: ['units'] })
      await queryClient.refetchQueries({ queryKey: ['unit', id] })
      
      toast({
        title: 'نجح',
        description: 'تم تحديث الوحدة بنجاح',
      })
      router.push(`/units/${id}`)
    } catch (error: any) {
      console.error('Error updating unit:', error)
      const errorMessage = error?.message || error?.error?.message || error?.details || 'فشل في تحديث الوحدة'
      toast({
        title: 'خطأ',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  function handleNewImageUpload(file: File) {
    const preview = URL.createObjectURL(file)
    setNewImages(prev => [...prev, { file, preview }])
  }

  function handleRemoveExistingImage(imageId: string) {
    setDeletedImageIds(prev => [...prev, imageId])
    setExistingImages(prev => prev.filter(img => img.id !== imageId))
    
    toast({
      title: 'نجح',
      description: 'تم حذف الصورة',
    })
  }

  function handleRemoveNewImage(index: number) {
    const imageToRemove = newImages[index]
    URL.revokeObjectURL(imageToRemove.preview)
    setNewImages(prev => prev.filter((_, i) => i !== index))
    
    toast({
      title: 'نجح',
      description: 'تم حذف الصورة',
    })
  }

  async function handleSetPrimaryImage(imageId: string) {
    // Update in database
    try {
      // Remove primary from all images
      await supabase
        .from('unit_images')
        .update({ is_primary: false })
        .eq('unit_id', id)
      
      // Set new primary
      await supabase
        .from('unit_images')
        .update({ is_primary: true })
        .eq('id', imageId)
    } catch (error) {
      console.error('Error updating primary image:', error)
    }

    // Update existing images to set primary
    setExistingImages(prev => {
      const updated = prev.map(img => ({
        ...img,
        is_primary: img.id === imageId,
      }))
      // Sort to put primary first
      return updated.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
    })
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-screen w-full" />
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">الوحدة غير موجودة</p>
        </div>
      </div>
    )
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
              <Edit className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                تعديل الوحدة
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">رقم الوحدة: {unit.unit_number}</p>
            </div>
          </div>
        </motion.div>

        <form 
          onSubmit={handleSubmit(
            onSubmit,
            (errors) => {
              console.error('Form validation errors:', errors)
              // Get first error message
              const firstError = Object.values(errors)[0]
              const errorMessage = firstError?.message || 'يرجى التحقق من جميع الحقول المطلوبة'
              toast({
                title: 'خطأ في التحقق',
                description: errorMessage,
                variant: 'destructive',
              })
            }
          )} 
          className="space-y-6"
        >
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
                  value={unit.location_id}
                  onValueChange={(value) => setValue('location_id', value)}
                >
                  <SelectTrigger className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800">
                    <SelectValue placeholder="اختر الموقع" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} - {location.name_ar}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-semibold">الاسم (English)</Label>
                <Input
                  id="name"
                  {...register('name')}
                  className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  placeholder="Enter unit name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name_ar" className="text-base font-semibold">الاسم (عربي)</Label>
                <Input
                  id="name_ar"
                  {...register('name_ar')}
                  className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                  placeholder="أدخل اسم الوحدة بالعربي"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-base font-semibold">النوع *</Label>
                <Select
                  value={unit.type}
                  onValueChange={(value) => setValue('type', value as any)}
                >
                  <SelectTrigger className="h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800">
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="room">غرفة</SelectItem>
                    <SelectItem value="suite">جناح</SelectItem>
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
                  value={unit.status}
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
                  id="unit-image-upload-edit"
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
                      handleNewImageUpload(file)
                    })
                    
                    // Reset input
                    e.target.value = ''
                  }}
                />
              </div>
            </motion.div>
            
            {/* Existing Images */}
            {existingImages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    الصور الموجودة ({existingImages.length})
                  </p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {existingImages.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative group border rounded-lg overflow-hidden aspect-square bg-muted"
                    >
                      <Image
                        src={image.url}
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
                          onClick={() => handleRemoveExistingImage(image.id)}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {!image.is_primary && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSetPrimaryImage(image.id)}
                            className="text-xs"
                          >
                            رئيسية
                          </Button>
                        )}
                      </div>
                      
                      {/* Primary badge */}
                      {image.is_primary && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                          رئيسية
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Images */}
            {newImages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    الصور الجديدة ({newImages.length})
                  </p>
                  {existingImages.length === 0 && newImages.length > 0 && (
                    <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                      الصورة الأولى ستكون الصورة الرئيسية
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {newImages.map((image, index) => (
                    <div
                      key={index}
                      className="relative group border rounded-lg overflow-hidden aspect-square bg-muted"
                    >
                      <Image
                        src={image.preview}
                        alt={`صورة جديدة ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      
                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => handleRemoveNewImage(index)}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        {index !== 0 && existingImages.length === 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              // Move to first position
                              const newImagesList = [...newImages]
                              const [selectedImage] = newImagesList.splice(index, 1)
                              newImagesList.unshift(selectedImage)
                              setNewImages(newImagesList)
                            }}
                            className="text-xs"
                          >
                            رئيسية
                          </Button>
                        )}
                      </div>
                      
                      {/* Primary badge */}
                      {index === 0 && existingImages.length === 0 && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                          رئيسية
                        </div>
                      )}
                      
                      {/* Image number */}
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        جديد
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
                    {facility.name} - {facility.name_ar}
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
              disabled={updateUnit.isPending}
              className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {updateUnit.isPending ? (
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
                  <Edit className="h-5 w-5" />
                  حفظ التغييرات
                </span>
              )}
            </Button>
          </motion.div>
        </form>
      </div>
    </div>
  )
}

