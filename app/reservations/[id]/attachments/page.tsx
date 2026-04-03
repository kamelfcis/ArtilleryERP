'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MultiFileUpload } from '@/components/upload/MultiFileUpload'
import { ArrowLeft, Download, Trash2, FileText, File, Image as ImageIcon, FileImage, FileVideo, FileCode, Printer, X } from 'lucide-react'
import { useReservation } from '@/lib/hooks/use-reservations'
import Image from 'next/image'

export default function ReservationAttachmentsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: reservation } = useReservation(id)
  const queryClient = useQueryClient()

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['reservation-attachments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservation_attachments')
        .select('*')
        .eq('reservation_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      const attachment = attachments?.find(a => a.id === attachmentId)
      if (!attachment) return

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('reservation-files')
        .remove([attachment.file_path])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase
        .from('reservation_attachments')
        .delete()
        .eq('id', attachmentId)

      if (dbError) throw dbError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation-attachments', id] })
      toast({
        title: 'نجح',
        description: 'تم حذف المرفق بنجاح',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف المرفق',
        variant: 'destructive',
      })
    },
  })

  async function handleUploadComplete(files: Array<{ url: string; path: string; name: string; size?: number }>) {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      // Get file sizes from storage
      const attachmentsToInsert = await Promise.all(
        files.map(async (file) => {
          // Try to get file metadata from storage
          let fileSize = file.size || 0
          try {
            const filePathParts = file.path.split('/')
            const fileName = filePathParts[filePathParts.length - 1]
            const folderPath = filePathParts.slice(0, -1).join('/') || id
            
            const { data: fileList } = await supabase.storage
              .from('reservation-files')
              .list(folderPath, {
                limit: 1000,
              })

            const fileData = fileList?.find(f => f.name === fileName)
            if (fileData?.metadata?.size) {
              fileSize = parseInt(fileData.metadata.size)
            }
          } catch (e) {
            // If we can't get size from storage, use provided size or 0
            console.warn('Could not get file size from storage:', e)
          }

          const fileType = file.name.split('.').pop()?.toLowerCase() || ''

          return {
            reservation_id: id,
            file_url: file.url,
            file_path: file.path,
            file_name: file.name,
            file_type: fileType,
            file_size: fileSize,
            uploaded_by: userId,
          }
        })
      )

      const { error } = await supabase
        .from('reservation_attachments')
        .insert(attachmentsToInsert)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['reservation-attachments', id] })
      toast({
        title: 'نجح',
        description: `تم رفع ${files.length} مرفق بنجاح`,
      })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في رفع المرفقات',
        variant: 'destructive',
      })
    }
  }

  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(null)

  function handleDownload(url: string, fileName: string) {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.target = '_blank'
    link.click()
  }

  function handlePrintAttachment(url: string, fileName: string) {
    const isImg = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName)
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    if (isImg) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${fileName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
            img { max-width: 100%; max-height: 100vh; object-fit: contain; }
            @media print {
              body { margin: 0; }
              img { max-width: 100%; max-height: 100%; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <img src="${url}" alt="${fileName}" onload="setTimeout(()=>{window.print();},300)" />
        </body>
        </html>
      `)
    } else {
      // For PDFs and other files, open in a new tab and let the user print from there
      printWindow.location.href = url
    }
    printWindow.document.close()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            رجوع
          </Button>
          <h1 className="text-3xl font-bold mb-2">مرفقات الحجز</h1>
          <p className="text-muted-foreground">
            {reservation?.reservation_number}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>رفع مرفقات جديدة</CardTitle>
        </CardHeader>
        <CardContent>
          <MultiFileUpload
            bucket="reservation-files"
            folder={id}
            onUploadComplete={handleUploadComplete}
            accept="*/*"
            maxFiles={10}
            maxSize={10}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المرفقات الحالية</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : attachments && attachments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {attachments.map((attachment) => {
                const isImage = attachment.file_type?.match(/^image\//) || 
                  ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(attachment.file_type || '')
                
                return (
                  <div
                    key={attachment.id}
                    className="border rounded-lg p-4 hover:bg-accent transition-colors"
                  >
                    {isImage ? (
                      <div
                        className="relative h-48 w-full rounded-lg overflow-hidden mb-2 cursor-pointer group"
                        onClick={() => setSelectedAttachment(attachment)}
                      >
                        <Image
                          src={attachment.file_url}
                          alt={attachment.file_name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
                            عرض
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="h-48 w-full rounded-lg bg-muted flex items-center justify-center mb-2 cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => setSelectedAttachment(attachment)}
                      >
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {isImage ? (
                          <ImageIcon className="h-4 w-4 text-blue-600" />
                        ) : ['pdf', 'doc', 'docx'].includes(attachment.file_type || '') ? (
                          <FileText className="h-4 w-4 text-red-600" />
                        ) : ['mp4', 'avi', 'mov'].includes(attachment.file_type || '') ? (
                          <FileVideo className="h-4 w-4 text-purple-600" />
                        ) : ['zip', 'rar', '7z'].includes(attachment.file_type || '') ? (
                          <FileCode className="h-4 w-4 text-orange-600" />
                        ) : (
                          <File className="h-4 w-4 text-gray-600" />
                        )}
                        <p className="text-sm font-medium truncate flex-1">{attachment.file_name}</p>
                      </div>
                      {attachment.file_size && (
                        <p className="text-xs text-muted-foreground">
                          {(attachment.file_size / 1024 / 1024).toFixed(2)} ميجابايت
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(attachment.file_url, attachment.file_name)}
                          className="flex-1"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          تحميل
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('هل أنت متأكد من حذف هذا المرفق؟')) {
                              deleteAttachment.mutate(attachment.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد مرفقات
            </div>
          )}
        </CardContent>
      </Card>
      {/* Lightbox Dialog */}
      <Dialog open={!!selectedAttachment} onOpenChange={(open) => { if (!open) setSelectedAttachment(null) }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold truncate pr-4">
                {selectedAttachment?.file_name}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedAttachment) {
                      handlePrintAttachment(selectedAttachment.file_url, selectedAttachment.file_name)
                    }
                  }}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  طباعة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedAttachment) {
                      handleDownload(selectedAttachment.file_url, selectedAttachment.file_name)
                    }
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  تحميل
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 min-h-[60vh] max-h-[80vh] overflow-auto bg-muted/30">
            {selectedAttachment && (
              (() => {
                const isImg = selectedAttachment.file_type?.match(/^image\//) ||
                  ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(selectedAttachment.file_type || '')
                return isImg ? (
                  <img
                    src={selectedAttachment.file_url}
                    alt={selectedAttachment.file_name}
                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <FileText className="h-24 w-24" />
                    <p className="text-lg font-medium">{selectedAttachment.file_name}</p>
                    <p className="text-sm">لا يمكن عرض هذا الملف مباشرة</p>
                  </div>
                )
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

