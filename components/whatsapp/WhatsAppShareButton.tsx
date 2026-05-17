'use client'

import { useState } from 'react'
import { MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'
import { buildContractHtml } from '@/lib/utils/build-contract-html'
import { useReservationServices } from '@/lib/hooks/use-services'
import type { Reservation } from '@/lib/types/database'

// A4 dimensions at 96 dpi (1 inch = 96px; 1mm = 96/25.4 px)
// 210mm × 297mm  →  794px × 1122px
const A4_W_PX = 794
const A4_H_PX = 1122

export function WhatsAppShareButton({ reservation }: { reservation: Reservation }) {
  const { data: reservationServices } = useReservationServices(reservation.id)
  const [sending, setSending] = useState(false)

  async function handleShare() {
    let iframe: HTMLIFrameElement | null = null
    try {
      setSending(true)

      const html = await buildContractHtml(reservation, {
        reservationServices: reservationServices || [],
      })

      // ── Inject a CSS override block so that inside the capture iframe:
      //    • 100vw = 794px (A4 width at 96 dpi)
      //    • 100vh = 1122px (A4 height at 96 dpi)
      // This makes `min-height: calc(100vh - 0.6in - 8px)` resolve to the same
      // value it resolves to in the browser's print engine, giving identical layout.
      const cssOverride = `
        <style id="pdf-override">
          html { width: ${A4_W_PX}px !important; height: ${A4_H_PX}px !important; overflow: visible !important; }
          body { width: ${A4_W_PX}px !important; min-height: ${A4_H_PX}px !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
        </style>`
      const htmlWithOverride = html.replace('</head>', cssOverride + '</head>')

      // ── Off-screen iframe: placed far to the left so it is never visible, but
      //    the browser renders it fully (unlike visibility:hidden which can skip fonts).
      iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText = [
        'position:fixed',
        `left:-${A4_W_PX + 100}px`,
        'top:0',
        `width:${A4_W_PX}px`,
        `height:${A4_H_PX}px`,
        'border:0',
        'background:#fff',
        'overflow:hidden',
      ].join(';')
      document.body.appendChild(iframe)

      const doc = iframe.contentDocument!
      doc.open()
      doc.write(htmlWithOverride)
      doc.close()

      // Wait for Google Fonts (Amiri) to load — the iframe is visible to the
      // renderer so web fonts are fetched immediately, just like the print window.
      try { await (iframe.contentWindow as any)?.document?.fonts?.ready } catch {}

      // Extra settle for images (logos are base64 so they resolve fast) + layout
      await new Promise((r) => setTimeout(r, 1000))

      const html2pdf = (await import('html2pdf.js')).default as any

      // ── html2canvas options:
      //    windowWidth / windowHeight must match the iframe's pixel size so that
      //    viewport-relative CSS units (vw, vh) resolve identically to the print engine.
      //    scale:3 gives 3× resolution for sharp Arabic text.
      const blob: Blob = await html2pdf()
        .set({
          margin: 3.81,   // 0.15in — same as @page margin in the contract stylesheet
          filename: `contract-${reservation.reservation_number}.pdf`,
          html2canvas: {
            scale: 3,
            useCORS: true,
            logging: false,
            windowWidth: A4_W_PX,
            windowHeight: A4_H_PX,
            backgroundColor: '#ffffff',
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          // Force a hard page-break before the rules page (page 2).
          // 'avoid: tr' prevents table rows from being sliced mid-row.
          pagebreak: { mode: ['css', 'legacy'], before: '.rules-page', avoid: 'tr' },
        })
        .from(doc.body)
        .outputPdf('blob')

      document.body.removeChild(iframe)
      iframe = null

      // Upload with cacheControl:0 so the CDN never serves a stale version
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

      // Cache-bust so WhatsApp's proxy can't serve an old PDF
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
      if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe)
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
