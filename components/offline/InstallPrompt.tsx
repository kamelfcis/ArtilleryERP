'use client'

/**
 * InstallPrompt
 *
 * Shows a "Install app" button when the browser fires the
 * `beforeinstallprompt` event (Chrome / Edge on Android + desktop).
 * On iOS/Safari, where the event never fires, shows a short manual
 * instruction instead.
 *
 * Rendered inside the Sidebar footer via lazy import so it never runs
 * during SSR (where navigator / window are undefined).
 */

import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// The beforeinstallprompt event is not in the standard TypeScript lib.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  return (
    ('standalone' in navigator && (navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Don't show if already installed / running as PWA.
    if (isInStandaloneMode()) {
      setInstalled(true)
      return
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    // iOS: no beforeinstallprompt — show the manual hint.
    if (isIOS() && !isInStandaloneMode()) {
      setShowIOSHint(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
    }
    setDeferredPrompt(null)
  }

  // Nothing to render.
  if (installed || dismissed) return null
  if (!deferredPrompt && !showIOSHint) return null

  // iOS manual instruction.
  if (showIOSHint) {
    return (
      <div className="mb-3 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-start gap-1.5">
            <Share className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              لتثبيت التطبيق: اضغط{' '}
              <span className="font-semibold text-foreground">مشاركة</span>
              {' '}ثم{' '}
              <span className="font-semibold text-foreground">إضافة إلى الشاشة الرئيسية</span>
            </span>
          </div>
          <button onClick={() => setDismissed(true)} className="shrink-0 opacity-50 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // Chrome / Edge install button.
  return (
    <div className="mb-3">
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs"
        onClick={handleInstall}
      >
        <Download className="h-3.5 w-3.5" />
        تثبيت التطبيق
      </Button>
    </div>
  )
}
