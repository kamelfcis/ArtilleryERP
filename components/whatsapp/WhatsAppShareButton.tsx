'use client'

import { useState } from 'react'
import { MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'
import { buildContractHtml } from '@/lib/utils/build-contract-html'
import { useReservationServices } from '@/lib/hooks/use-services'
import type { Reservation } from '@/lib/types/database'

// A4 at 96 dpi: 210mm → 794 px, 297mm → 1122 px
const A4_W = 794
const A4_H = 1122

// calc(100vh - 0.6in - 8px) where 100vh = 1122px, 0.6in = 57.6px
const PAGE_BORDER_MIN_H = Math.round(A4_H - 0.6 * 96 - 8) // ≈ 1056 px

export function WhatsAppShareButton({ reservation }: { reservation: Reservation }) {
  const { data: reservationServices } = useReservationServices(reservation.id)
  const [sending, setSending] = useState(false)

  async function handleShare() {
    // DOM nodes injected during capture — always removed in finally block
    let captureRoot: HTMLDivElement | null = null
    let styleTag: HTMLStyleElement | null = null
    let overlay: HTMLDivElement | null = null

    try {
      setSending(true)

      const html = await buildContractHtml(reservation, {
        reservationServices: reservationServices || [],
      })

      // ── 1. Extract <style> blocks and <body> content from the full HTML ──────
      const rawStyles = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [])
        .map((s) => s.replace(/<\/?style[^>]*>/gi, ''))
        .join('\n')

      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      const bodyContent = bodyMatch ? bodyMatch[1] : ''

      // ── 2. Scope CSS to #__wa_pdf_root so it never bleeds into the app UI ───
      //  • Replace bare body/html selectors with the container id
      //  • Drop @page rules (not applicable in screen context)
      //  • Replace calc(100vh…) min-height with a fixed A4 pixel value
      const scopedCss =
        rawStyles
          .replace(/@page\s*\{[^}]*\}/g, '')
          .replace(/\bbody\b(\s*\{)/g, '#__wa_pdf_root$1')
          .replace(/\bhtml\b(\s*\{)/g, '#__wa_pdf_root$1') +
        `\n#__wa_pdf_root .page-border { min-height: ${PAGE_BORDER_MIN_H}px !important; }`

      styleTag = document.createElement('style')
      styleTag.id = '__wa_pdf_styles'
      styleTag.textContent = scopedCss
      document.head.appendChild(styleTag)

      // ── 3. Full-screen overlay hides the contract from the user ──────────────
      // html2canvas captures only the target element's own DOM subtree, so the
      // overlay (which sits on top in z-order) is invisible in the final PDF.
      overlay = document.createElement('div')
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;pointer-events:none;'
      document.body.appendChild(overlay)

      // ── 4. Render container at (0,0) — a real viewport position ─────────────
      // IMPORTANT: z-index must be POSITIVE so html2canvas composites it above
      // the document background.  A negative z-index caused the body to paint
      // over the element, producing a completely blank canvas (= empty PDF).
      captureRoot = document.createElement('div')
      captureRoot.id = '__wa_pdf_root'
      captureRoot.setAttribute('dir', 'rtl')
      captureRoot.style.cssText = [
        'position:fixed',
        'left:0',
        'top:0',
        `width:${A4_W}px`,
        `min-height:${A4_H * 2}px`,
        'overflow:visible',
        'background:#fff',
        'z-index:9999', // below overlay (10000) → hidden from user, but valid for html2canvas
        'direction:rtl',
        'color:#000',
        'font-size:14px',
        'line-height:1.4',
      ].join(';')
      captureRoot.innerHTML = bodyContent
      document.body.appendChild(captureRoot)

      // ── 5. Wait for web fonts (Amiri @import inside scopedCss) ───────────────
      await document.fonts.ready
      await new Promise((r) => setTimeout(r, 1000))

      // ── 6. Generate PDF via html2pdf (html2canvas → jsPDF) ───────────────────
      const html2pdf = (await import('html2pdf.js')).default as any
      const blob: Blob = await html2pdf()
        .set({
          margin: 3.81,
          filename: `contract-${reservation.reservation_number}.pdf`,
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: A4_W,
            windowHeight: A4_H,
            backgroundColor: '#ffffff',
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], before: '.rules-page', avoid: 'tr' },
        })
        .from(captureRoot)
        .outputPdf('blob')

      // ── 7. Upload to Supabase with no CDN cache ───────────────────────────────
      // NOTE: we deliberately delete-then-insert instead of using { upsert: true }.
      // The reservation-files bucket has RLS policies for INSERT and DELETE but
      // NOT for UPDATE. upsert triggers UPDATE on existing rows → 400. Removing
      // first and inserting fresh stays inside the allowed policy set.
      if (!blob || blob.size === 0) {
        throw new Error('فشل توليد ملف العقد - الملف فارغ')
      }

      const path = `${reservation.id}/contract.pdf`

      // Best-effort delete; ignore "object not found" errors on first upload.
      await supabase.storage.from('reservation-files').remove([path])

      const { error: upErr } = await supabase.storage
        .from('reservation-files')
        .upload(path, blob, {
          contentType: 'application/pdf',
          cacheControl: '0',
        })
      if (upErr) throw upErr

      const {
        data: { publicUrl },
      } = supabase.storage.from('reservation-files').getPublicUrl(path)

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
      const message = e instanceof Error ? e.message : 'حدث خطأ غير متوقع'
      toast({ title: 'فشل الإرسال', description: message, variant: 'destructive' })
    } finally {
      if (captureRoot && document.body.contains(captureRoot)) document.body.removeChild(captureRoot)
      if (overlay && document.body.contains(overlay)) document.body.removeChild(overlay)
      if (styleTag && document.head.contains(styleTag)) document.head.removeChild(styleTag)
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
