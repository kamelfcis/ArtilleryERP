'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/offline/db'
import { WifiOff, RefreshCw, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OfflineBannerProps {
  /** Callback when the user manually triggers a sync. */
  onSyncRequest?: () => void
  /** Whether a sync is currently in progress. */
  syncing?: boolean
}

export function OfflineBanner({ onSyncRequest, syncing = false }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState(0)

  // Track online/offline
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Poll the outbox count every 3 s so the number stays fresh without a
  // subscription (Dexie live queries are overkill for a count badge).
  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      if (!mounted) return
      try {
        const count = await db.outbox.count()
        if (mounted) setPendingCount(count)
      } catch {
        // IDB not available in SSR — ignore.
      }
    }

    refresh()
    const id = setInterval(refresh, 3000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  // Don't render anything if online and no pending mutations.
  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium transition-all',
        isOnline
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-b border-amber-200/50'
          : 'bg-red-500/10 text-red-700 dark:text-red-400 border-b border-red-200/50'
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <RefreshCw className={cn('h-4 w-4 shrink-0', syncing && 'animate-spin')} />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" />
        )}
        <span>
          {isOnline
            ? 'متصل — جارٍ مزامنة التغييرات المعلقة'
            : 'غير متصل — ستُحفظ التغييرات وتُزامن تلقائياً عند الاتصال'}
        </span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-current/10 px-2 py-0.5 text-xs">
            <Clock className="h-3 w-3" />
            {pendingCount} معلق
          </span>
        )}
      </div>

      {isOnline && pendingCount > 0 && onSyncRequest && (
        <button
          onClick={onSyncRequest}
          disabled={syncing}
          className="rounded-md px-3 py-1 text-xs font-semibold ring-1 ring-current hover:bg-current/10 disabled:opacity-50 transition-colors"
        >
          {syncing ? 'جارٍ المزامنة…' : 'مزامنة الآن'}
        </button>
      )}
    </div>
  )
}
