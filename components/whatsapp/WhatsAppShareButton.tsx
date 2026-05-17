'use client'

import { useState } from 'react'
import { MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'
import { buildContractHtml } from '@/lib/utils/build-contract-html'
import { useReservationServices } from '@/lib/hooks/use-services'
import type { Reservation } from '@/lib/types/database'

export function WhatsAppShareButton({ reservation }: { reservation: Reservation }) {
  const { data: reservationServices } = useReservationServices(reservation.id)
  const [sending, setSending] = useState(false)

  async function handleShare() {
    let pdfWindow: Window | null = null
    try {
      setSending(true)

      const html = await buildContractHtml(reservation, {
        reservationServices: reservationServices || [],
      })

      // Open a real browser window — identical to what the print button does.
      // Real windows fully load web fonts (Google Fonts / Amiri), so the layout
      // rendered here is byte-for-byte the same as the print output.
      // We position it off-screen so the user doesn't see a flash.
      pdfWindow = window.open('', '_blank', 'width=794,height=1122,left=-9999,top=0')
      if (!pdfWindow) throw new Error('لم يتمكن المتصفح من فتح النافذة — تأكد من السماح بالنوافذ المنبثقة')

      pdfWindow.document.open()
      pdfWindow.document.write(html)
      pdfWindow.document.close()

      // Wait for web fonts (Amiri from Google Fonts) to fully load in that window
      await pdfWindow.document.fonts.ready

      // Extra settle time for images and layout (same base64 images as print)
      await new Promise((r) => setTimeout(r, 800))

      // Capture the rendered document as a PDF blob.
      // Settings mirror the @page rule in build-contract-html.ts (0.15in margin)
      // and the A4 content area (794px wide at 96 dpi).
      const html2pdf = (await import('html2pdf.js')).default as any
      const blob: Blob = await html2pdf()
        .set({
          margin: 3.81,   // 0.15in converted to mm
          filename: `contract-${reservation.reservation_number}.pdf`,
          html2canvas: {
            scale: 3,
            useCORS: true,
            logging: false,
            windowWidth: 794,   // A4 at 96 dpi (210mm × 96 / 25.4)
            backgroundColor: '#ffffff',
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], before: '.rules-page', avoid: 'tr' },
        })
        .from(pdfWindow.document.body)
        .outputPdf('blob')

      pdfWindow.close()
      pdfWindow = null

      // Upload to Supabase Storage with no CDN caching so the guest always gets the fresh PDF
      const path = `${reservation.id}/contract.pdf`
      const { error: upErr } = await supabase.storage
        .from('reservation-files')
        .upload(path, blob, {
          upsert: true,
          contentType: 'application/pdf',
          cacheControl: '0',
        })
      if (upErr) throw upErr

      const {
        data: { publicUrl },
      } = supabase.storage.from('reservation-files').getPublicUrl(path)

      // Append a cache-buster so WhatsApp's own proxy can't serve a stale version
      const publicUrlWithBust = `${publicUrl}?v=${Date.now()}`

      const guestName =
        `${reservation.guest?.first_name_ar || reservation.guest?.first_name || ''} ${reservation.guest?.last_name_ar || reservation.guest?.last_name || ''}`.trim()
      const msg =
        `مرحباً ${guestName || 'ضيفنا الكريم'}\nرابط عقد الحجز رقم ${reservation.reservation_number}:\n${publicUrlWithBust}`

      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
        '_blank',
      )

      toast({
        title: 'تم تجهيز الرسالة',
        description: 'تم فتح واتساب — اختر جهة الاتصال ثم اضغط إرسال',
      })
    } catch (e: unknown) {
      if (pdfWindow) { try { pdfWindow.close() } catch {} }
      const message = e instanceof Error ? e.message : 'حدث خطأ غير متوقع'
      toast({ title: 'فشل الإرسال', description: message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handleShare}
      disabled={sending}
      className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0"
    >
      {sending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="mr-2 h-4 w-4" />
      )}
      {sending ? 'جاري التجهيز...' : 'إرسال عبر واتساب'}
    </Button>
  )
}
