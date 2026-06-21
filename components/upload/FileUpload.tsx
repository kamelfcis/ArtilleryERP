'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Upload, X } from 'lucide-react'
import Image from 'next/image'
import { uploadToR2 } from '@/lib/storage/upload'
import type { StorageBucket } from '@/lib/storage/r2-client'

interface FileUploadProps {
  bucket: StorageBucket
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
      const uploadPromises = filesArray.map(async (file) => {
        const fileExt = file.name.split('.').pop()?.toLowerCase()
        if (!fileExt) {
          throw new Error('امتداد الملف غير صحيح')
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = folder ? `${folder}/${fileName}` : fileName

        const publicUrl = await uploadToR2(bucket, filePath, file)
        return { url: publicUrl, path: filePath }
      })

      const results = await Promise.all(uploadPromises)

      results.forEach(result => {
        onUploadComplete(result.url, result.path)
      })

      if (results.length === 1 && accept.startsWith('image/') && !multiple) {
        setPreview(results[0].url)
      } else if (multiple) {
        setPreview(null)
      }

      toast({
        title: 'نجح',
        description: `تم رفع ${results.length} ملف بنجاح`,
      })
    } catch (error: unknown) {
      console.error('Upload error:', error)
      let errorMessage = 'فشل في رفع الملف'

      const err = error as { message?: string; statusCode?: string }
      if (err?.message) {
        errorMessage = err.message
      } else if (err?.statusCode === '400') {
        errorMessage = 'صيغة الملف غير مدعومة أو حجم الملف كبير جداً'
      }

      toast({
        title: 'خطأ',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
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
