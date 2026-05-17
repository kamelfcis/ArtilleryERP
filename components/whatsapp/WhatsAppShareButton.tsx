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
const A4_W_PX = 794
const A4_H_PX = 1122

// Helper: trigger a local file download from a Blob (fallback when upload fails)
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Helper: wait for all <img> elements in a document to finish loading.
// html2canvas' "useCORS" still requires the image to be decoded before capture.
function waitForAllImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.images)
  if (imgs.length === 0) return Promise.resolve()
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve()
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  ).then(() => undefined)
}

export function WhatsAppShareButton({ reservation }: { reservation: Reservation }) {
  const { data: reservationServices } = useReservationServices(reservation.id)
  const [sending, setSending] = useState(false)

  async function handleShare() {
    let iframe: HTMLIFrameElement | null = null

    try {
      setSending(true)

      // ── 1. Build the same HTML the print flow uses ──────────────────────────
      const html = await buildContractHtml(reservation, {
        reservationServices: reservationServices || [],
      })

      // ── 2. Render in a real same-origin iframe via srcdoc ───────────────────
      // The browser performs its full native layout pass here — RTL shaping,
      // Arabic font fallbacks, flex containers, tables — exactly the same as
      // the working print preview. We later capture from this iframe.
      iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText = [
        'position:absolute',
        'left:0',
        'top:0',
        `width:${A4_W_PX}px`,
        `height:${A4_H_PX * 3}px`, // tall enough to hold both pages without scrollbars
        'border:0',
        'opacity:0',
        'pointer-events:none',
        'z-index:-1',
      ].join(';')
      document.body.appendChild(iframe)

      // srcdoc loads the HTML as a complete same-origin document
      iframe.srcdoc = html

      // Wait for the iframe document to fully load
      await new Promise<void>((resolve, reject) => {
        const onLoad = () => resolve()
        const onError = () => reject(new Error('iframe failed to load contract HTML'))
        iframe!.addEventListener('load', onLoad, { once: true })
        iframe!.addEventListener('error', onError, { once: true })
      })

      const idoc = iframe.contentDocument
      const iwin = iframe.contentWindow
      if (!idoc || !iwin) throw new Error('iframe document not accessible')

      // ── 3. Wait for fonts and images inside the iframe ──────────────────────
      try {
        await (idoc as any).fonts?.ready
      } catch {
        /* font loading API not available — fall through */
      }
      await waitForAllImages(idoc)
      // small extra tick for the layout engine
      await new Promise((r) => setTimeout(r, 400))

      // ── 4. Capture each .page element to its own canvas ─────────────────────
      const pageEls = Array.from(idoc.querySelectorAll<HTMLElement>('.page'))
      if (pageEls.length === 0) throw new Error('No .page elements found in contract HTML')

      // Lazy-load the libs to keep first paint snappy
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true,
      })

      const A4_W_MM = pdf.internal.pageSize.getWidth() // 210
      const A4_H_MM = pdf.internal.pageSize.getHeight() // 297
      const MARGIN_MM = 3.81 // matches @page margin: 0.15in in the print stylesheet
      const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2
      const CONTENT_H_MM = A4_H_MM - MARGIN_MM * 2

      for (let i = 0; i < pageEls.length; i++) {
        const pageEl = pageEls[i]
        // Force a fixed pixel width so it can never collapse
        pageEl.style.width = `${A4_W_PX}px`

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: A4_W_PX,
          windowHeight: A4_H_PX,
          // Important: tell html2canvas to use the iframe's window so the
          // "ownerDocument" matches the element being captured.  Without this
          // the cloning step copies styles from the OUTER document (where
          // none of the contract CSS exists) and produces a blank canvas.
          // The undocumented 4th-arg / `foreignObjectRendering: false` keep
          // the manual painter active (more reliable for RTL than SVG mode).
          foreignObjectRendering: false,
          // ownerDocument is undocumented in @types/html2canvas but accepted
          // at runtime — that's why the whole options object is cast to any.
          ownerDocument: idoc,
        } as any)

        if (!canvas || canvas.width === 0 || canvas.height === 0) {
          throw new Error(`page ${i + 1} rendered as a 0x0 canvas`)
        }

        // Quick sanity check: is the canvas all-white?  If so, we caught an
        // empty render and should fail fast with a useful message.
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const sample = ctx.getImageData(
            Math.floor(canvas.width / 2),
            Math.floor(canvas.height / 2),
            1,
            1,
          ).data
          // RGBA - if the very center pixel is pure white AND the canvas is
          // larger than a thumbnail, dump a console warning so we can spot it
          // in DevTools.  (We don't throw — the page may legitimately have
          // white space at the middle.)
          if (sample[0] === 255 && sample[1] === 255 && sample[2] === 255) {
            // eslint-disable-next-line no-console
            console.debug(`[whatsapp-pdf] page ${i + 1} center pixel is white`)
          }
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage()

        // Fit the canvas inside the printable area, preserving aspect ratio
        const canvasRatio = canvas.height / canvas.width
        let drawW = CONTENT_W_MM
        let drawH = CONTENT_W_MM * canvasRatio
        if (drawH > CONTENT_H_MM) {
          drawH = CONTENT_H_MM
          drawW = CONTENT_H_MM / canvasRatio
        }
        const offsetX = MARGIN_MM + (CONTENT_W_MM - drawW) / 2
        const offsetY = MARGIN_MM + (CONTENT_H_MM - drawH) / 2
        pdf.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH, undefined, 'FAST')
      }

      // ── 5. Build the final blob and validate it isn't empty ─────────────────
      const blob = pdf.output('blob') as Blob
      // eslint-disable-next-line no-console
      console.debug(`[whatsapp-pdf] generated blob size = ${blob.size} bytes`)
      if (!blob || blob.size < 5_000) {
        throw new Error(`PDF generation produced a suspiciously small blob (${blob?.size ?? 0} bytes)`)
      }

      // ── 6. Upload to Supabase (delete first → bypass missing UPDATE RLS) ───
      const path = `${reservation.id}/contract.pdf`
      let uploadFailed = false

      await supabase.storage.from('reservation-files').remove([path]).catch(() => undefined)

      const { error: upErr } = await supabase.storage
        .from('reservation-files')
        .upload(path, blob, {
          contentType: 'application/pdf',
          cacheControl: '0',
        })

      if (upErr) {
        uploadFailed = true
        // eslint-disable-next-line no-console
        console.error('[whatsapp-pdf] supabase upload failed:', upErr)
      }

      // ── 7. Either share via URL or fall back to local download ─────────────
      const guestName =
        `${reservation.guest?.first_name_ar || reservation.guest?.first_name || ''} ${reservation.guest?.last_name_ar || reservation.guest?.last_name || ''}`.trim()

      if (!uploadFailed) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('reservation-files').getPublicUrl(path)
        const publicUrlWithBust = `${publicUrl}?v=${Date.now()}`
        const msg =
        `🏨✨ فندق كينج توت — إدارة المدفعية ✨🏨
      
      أهلاً وسهلاً بكم 🤝💚
      الأستاذ/ة الفاضل/ة: ${guestName || 'ضيفنا الكريم'}
      
      يسعدنا أن نرحب بكم ضيوفاً كراماً في نزلنا، ونتمنى لكم إقامة مريحة وهادئة مليئة بالطمأنينة والخير 🌿😊
      
      📎 نرفق لكم رابط عقد الحجز الخاص بكم:
      🔢 رقم العقد: ${reservation.reservation_number}
      
      🔗 الرابط:
      ${publicUrlWithBust}
      
      نتمنى لكم أياماً سعيدة وبداية إقامة موفقة 🌟
      مع أطيب التحيات والتقدير 💐
      فريق الإسكان — فندق كينج توت 🏖️❤️`
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank')

        toast({
          title: 'تم تجهيز الرسالة',
          description: 'تم فتح واتساب — اختر جهة الاتصال ثم اضغط إرسال',
        })
      } else {
        // Upload failed but we still have a valid PDF — let the user download
        // it locally so the WhatsApp flow is never completely broken.
        downloadBlob(blob, `contract-${reservation.reservation_number}.pdf`)
        toast({
          title: 'تم توليد العقد',
          description: 'تعذر الرفع للسحابة، تم تحميل الملف محلياً لإرساله يدوياً',
          variant: 'destructive',
        })
      }
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error('[whatsapp-pdf] handleShare failed:', e)
      const message = e instanceof Error ? e.message : 'حدث خطأ غير متوقع'
      toast({ title: 'فشل الإرسال', description: message, variant: 'destructive' })
    } finally {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe)
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
