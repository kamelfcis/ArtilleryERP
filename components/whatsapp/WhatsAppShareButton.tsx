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
    try {
      setSending(true)

      const html = await buildContractHtml(reservation, {
        reservationServices: reservationServices || [],
      })

      const iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText =
        'position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:0;visibility:hidden'
      document.body.appendChild(iframe)
      const doc = iframe.contentDocument
      if (!doc) {
        document.body.removeChild(iframe)
        throw new Error('تعذر إنشاء إطار المعاينة')
      }
      doc.open()
      doc.write(html)
      doc.close()
      await new Promise((r) => setTimeout(r, 150))

      const html2pdf = (await import('html2pdf.js')).default as any
      const blob: Blob = await html2pdf()
        .set({
          margin: 0,
          filename: `contract-${reservation.reservation_number}.pdf`,
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(doc.body)
        .outputPdf('blob')

      document.body.removeChild(iframe)

      const path = `contracts/${reservation.id}.pdf`
      const { error: upErr } = await supabase.storage
        .from('reservation-files')
        .upload(path, blob, { upsert: true, contentType: 'application/pdf' })
      if (upErr) throw upErr

      const {
        data: { publicUrl },
      } = supabase.storage.from('reservation-files').getPublicUrl(path)

      const guestName =
        `${reservation.guest?.first_name_ar || reservation.guest?.first_name || ''} ${reservation.guest?.last_name_ar || reservation.guest?.last_name || ''}`.trim()
      const msg =
        `مرحباً ${guestName || 'ضيفنا الكريم'}\nرابط عقد الحجز رقم ${reservation.reservation_number}:\n${publicUrl}`

      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
        '_blank',
      )

      toast({
        title: 'تم تجهيز الرسالة',
        description: 'تم فتح واتساب — اختر جهة الاتصال ثم اضغط إرسال',
      })
    } catch (e: unknown) {
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
