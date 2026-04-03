'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface MultiFileUploadProps {
  bucket: 'unit-images' | 'reservation-files'
  folder?: string
  onUploadComplete: (files: Array<{ url: string; path: string; name: string; size?: number }>) => void
  accept?: string
  maxSize?: number // in MB
  maxFiles?: number
  existingFiles?: Array<{ url: string; path: string; name: string; id?: string }>
  onDelete?: (fileId: string) => void
}

export function MultiFileUpload({
  bucket,
  folder,
  onUploadComplete,
  accept = 'image/*',
  maxSize = 5,
  maxFiles = 10,
  existingFiles = [],
  onDelete,
}: MultiFileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previews, setPreviews] = useState<Array<{ url: string; path: string; name: string }>>(existingFiles)

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    if (previews.length + files.length > maxFiles) {
      toast({
        title: 'خطأ',
        description: `يمكن رفع ${maxFiles} ملف كحد أقصى`,
        variant: 'destructive',
      })
      return
    }

    setUploading(true)

    try {
      const uploadedFiles: Array<{ url: string; path: string; name: string }> = []

      for (const file of files) {
        // Check file size
        if (file.size > maxSize * 1024 * 1024) {
          toast({
            title: 'خطأ',
            description: `حجم الملف ${file.name} يجب أن يكون أقل من ${maxSize} ميجابايت`,
            variant: 'destructive',
          })
          continue
        }

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = folder ? `${folder}/${fileName}` : fileName

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error(uploadError.message || 'فشل في رفع الملف')
        }

        // Both buckets are public, so use public URLs
        const { data } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath)

        uploadedFiles.push({
          url: data.publicUrl,
          path: filePath,
          name: file.name,
        })
      }

      const newPreviews = [...previews, ...uploadedFiles]
      setPreviews(newPreviews)
      onUploadComplete(newPreviews)

      toast({
        title: 'نجح',
        description: `تم رفع ${uploadedFiles.length} ملف بنجاح`,
      })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في رفع الملفات',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(index: number, fileId?: string) {
    if (fileId && onDelete) {
      onDelete(fileId)
    }
    const newPreviews = previews.filter((_, i) => i !== index)
    setPreviews(newPreviews)
    onUploadComplete(newPreviews)
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            اضغط لرفع ملفات أو اسحب الملفات هنا
          </p>
          <p className="text-xs text-muted-foreground">
            الحد الأقصى: {maxFiles} ملفات، حجم كل ملف: {maxSize} ميجابايت
          </p>
          <Button
            variant="outline"
            disabled={uploading || previews.length >= maxFiles}
            onClick={() => document.getElementById('multi-file-upload')?.click()}
          >
            {uploading ? 'جاري الرفع...' : 'اختر ملفات'}
          </Button>
          <input
            id="multi-file-upload"
            type="file"
            accept={accept}
            multiple
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              {accept.startsWith('image/') ? (
                <div className="relative h-32 w-full rounded-lg overflow-hidden border">
                  <Image
                    src={preview.url}
                    alt={preview.name}
                    fill
                    className="object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(index, (preview as any).id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative h-32 w-full rounded-lg border flex items-center justify-center bg-muted">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(index, (preview as any).id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 truncate">{preview.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

