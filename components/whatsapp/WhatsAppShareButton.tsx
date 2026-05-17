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

      // Build the contract HTML (logos are embedded as base64 by buildContractHtml)
      const html = await buildContractHtml(reservation, {
        reservationServices: reservationServices || [],
      })

      // Call the server-side Puppeteer route which renders the HTML using Chrome's
      // print engine — identical output to the browser's "Print / Save as PDF" dialog.
      const response = await fetch('/api/generate-contract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${response.status}`)
      }

      const blob = await response.blob()

      // Upload PDF to Supabase Storage so we can share a public link via WhatsApp
      const path = `${reservation.id}/contract.pdf`
      const { error: upErr } = await supabase.storage
        .from('reservation-files')
        .upload(path, blob, {
          upsert: true,
          contentType: 'application/pdf',
          cacheControl: '0',  // disable CDN cache so guests always get the latest PDF
        })
      if (upErr) throw upErr

      const {
        data: { publicUrl },
      } = supabase.storage.from('reservation-files').getPublicUrl(path)

      // Append a timestamp to bust any intermediate proxy/CDN cache
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
