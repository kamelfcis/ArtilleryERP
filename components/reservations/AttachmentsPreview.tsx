'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Paperclip, FileText, Image as ImageIcon, Download, ExternalLink, Printer } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface AttachmentsPreviewProps {
  reservationId: string
  maxDisplay?: number
}

export function AttachmentsPreview({ reservationId, maxDisplay = 3 }: AttachmentsPreviewProps) {
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
      printWindow.location.href = url
    }
    printWindow.document.close()
  }

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['reservation-attachments', reservationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservation_attachments')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: false })
        .limit(maxDisplay + 1)

      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            المرفقات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!attachments || attachments.length === 0) {
    return null
  }

  const displayAttachments = attachments.slice(0, maxDisplay)
  const hasMore = attachments.length > maxDisplay

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            المرفقات ({attachments.length})
          </CardTitle>
          <Link href={`/reservations/${reservationId}/attachments`}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              عرض الكل
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {displayAttachments.map((attachment) => {
            const isImage = attachment.file_type?.match(/^(image|jpg|jpeg|png|gif|webp)/i) ||
              ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(attachment.file_type || '')

            return (
              <div
                key={attachment.id}
                className="border rounded-lg p-3 hover:bg-accent transition-colors"
              >
                {isImage ? (
                  <div
                    className="relative h-32 w-full rounded-lg overflow-hidden mb-2 cursor-pointer group"
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
                    className="h-32 w-full rounded-lg bg-muted flex items-center justify-center mb-2 cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => setSelectedAttachment(attachment)}
                  >
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <p className="text-xs font-medium truncate mb-1">{attachment.file_name}</p>
                {attachment.file_size && (
                  <p className="text-xs text-muted-foreground">
                    {(attachment.file_size / 1024 / 1024).toFixed(2)} ميجابايت
                  </p>
                )}
              </div>
            )
          })}
        </div>
        {hasMore && (
          <div className="mt-4 text-center">
            <Link href={`/reservations/${reservationId}/attachments`}>
              <Button variant="outline" size="sm">
                عرض {attachments.length - maxDisplay} مرفق إضافي
              </Button>
            </Link>
          </div>
        )}
      </CardContent>

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
                const isImg = selectedAttachment.file_type?.match(/^(image|jpg|jpeg|png|gif|webp)/i) ||
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
    </Card>
  )
}

