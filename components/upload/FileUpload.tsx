'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Upload, X } from 'lucide-react'
import Image from 'next/image'

interface FileUploadProps {
  bucket: 'unit-images' | 'reservation-files'
  folder?: string
  onUploadComplete: (url: string, path: string) => void
  accept?: string
  maxSize?: number // in MB
  multiple?: boolean
}

export function FileUpload({
  bucket,
  folder,
  onUploadComplete,
  accept = 'image/*',
  maxSize = 5,
  multiple = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    const filesArray = Array.from(files)
    
    // Check file sizes
    const oversizedFiles = filesArray.filter(file => file.size > maxSize * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      toast({
        title: 'خطأ',
        description: `بعض الملفات أكبر من ${maxSize} ميجابايت`,
        variant: 'destructive',
      })
      return
    }

    setUploading(true)

    try {
      // Upload all files directly - if bucket doesn't exist or no permissions, upload will fail
      // This is better than checking listBuckets() which may fail due to RLS policies
      const uploadPromises = filesArray.map(async (file) => {
        const fileExt = file.name.split('.').pop()?.toLowerCase()
        if (!fileExt) {
          throw new Error('امتداد الملف غير صحيح')
        }
        
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = folder ? `${folder}/${fileName}` : fileName

        // Upload file
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          // Handle specific storage errors
          if (uploadError.message?.includes('already exists') || (uploadError as any).statusCode === '409') {
            // File already exists, generate new name
            const newFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${Math.random().toString(36).substring(7)}.${fileExt}`
            const newFilePath = folder ? `${folder}/${newFileName}` : newFileName
            
            const { error: retryError } = await supabase.storage
              .from(bucket)
              .upload(newFilePath, file, {
                cacheControl: '3600',
                upsert: false,
              })
            
            if (retryError) throw retryError
            
            const { data } = supabase.storage
              .from(bucket)
              .getPublicUrl(newFilePath)
            
            return { url: data.publicUrl, path: newFilePath }
          } else {
            throw uploadError
          }
        } else {
          const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath)

          return { url: data.publicUrl, path: filePath }
        }
      })

      const results = await Promise.all(uploadPromises)
      
      // Call onUploadComplete for each uploaded file
      results.forEach(result => {
        onUploadComplete(result.url, result.path)
      })

      // Set preview to first image if single file (only for single file uploads)
      if (results.length === 1 && accept.startsWith('image/') && !multiple) {
        setPreview(results[0].url)
      } else if (multiple) {
        // Clear preview for multiple uploads as images will be shown in parent component
        setPreview(null)
      }

      toast({
        title: 'نجح',
        description: `تم رفع ${results.length} ملف بنجاح`,
      })
    } catch (error: any) {
      console.error('Upload error:', error)
      let errorMessage = 'فشل في رفع الملف'
      
      if (error?.message) {
        // Check for specific bucket errors
        if (error.message.includes('Bucket not found') || error.message.includes('does not exist')) {
          errorMessage = `البكت "${bucket}" غير موجود. يرجى التحقق من إنشاء الـ bucket في Supabase Dashboard.`
        } else if (error.message.includes('new row violates row-level security') || error.message.includes('RLS')) {
          errorMessage = 'ليس لديك صلاحية لرفع الملفات. يرجى التحقق من صلاحيات المستخدم.'
        } else {
          errorMessage = error.message
        }
      } else if (error?.statusCode === '400') {
        errorMessage = 'صيغة الملف غير مدعومة أو حجم الملف كبير جداً'
      } else if (error?.statusCode === '409') {
        errorMessage = 'الملف موجود بالفعل. يرجى المحاولة مرة أخرى.'
      } else if (error?.statusCode === '404') {
        errorMessage = `البكت "${bucket}" غير موجود. يرجى إنشاء الـ bucket في Supabase Dashboard أولاً.`
      }
      
      toast({
        title: 'خطأ',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      // Reset input to allow uploading same file again
      event.target.value = ''
    }
  }

  function handleRemove() {
    setPreview(null)
  }

  return (
    <div className="space-y-4">
      {preview && accept.startsWith('image/') ? (
        <div className="relative w-full h-48 border rounded-lg overflow-hidden">
          <Image
            src={preview}
            alt="Preview"
            fill
            className="object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 left-2"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleRemove()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              اضغط لرفع ملف أو اسحب الملف هنا
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                document.getElementById('file-upload')?.click()
              }}
            >
              {uploading ? 'جاري الرفع...' : 'اختر ملف'}
            </Button>
            <input
              id="file-upload"
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={handleUpload}
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  )
}

