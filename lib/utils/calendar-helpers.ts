import { Home, Hotel, Mountain, Layers, Building, Building2 } from 'lucide-react'

// ─── Apartment room-count gradient ───────────────────────────────────────────

const SHAKKA_3_ROOM_GRADIENT = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
const SHAKKA_2_ROOM_GRADIENT = 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)'

export function getShakkaRoomIconGradient(unit: {
  type?: string
  name?: string
  name_ar?: string
  beds?: number
} | null | undefined): string | null {
  if (!unit) return null
  const text = `${unit.name_ar || ''} ${unit.name || ''}`
  const isApartment = unit.type === 'apartment' || /شقة/.test(text)
  if (!isApartment) return null

  const bundle = text.toLowerCase()
  const has3 =
    /(^|[^\d])3\s*غرف/.test(bundle) ||
    /٣\s*غرف/.test(text) ||
    /ثلاث\s*غرف/.test(bundle) ||
    /3\s*bedroom/.test(bundle)
  const has2 =
    /(^|[^\d])2\s*غرف/.test(bundle) ||
    /٢\s*غرف/.test(text) ||
    /غرفتين/.test(bundle) ||
    /2\s*bedroom/.test(bundle)

  if (has3 && !has2) return SHAKKA_3_ROOM_GRADIENT
  if (has2 && !has3) return SHAKKA_2_ROOM_GRADIENT
  if (has3 && has2) {
    const pos3Candidates = [
      bundle.search(/3\s*غرف/),
      bundle.search(/ثلاث\s*غرف/),
      text.search(/٣\s*غرف/),
    ].filter(i => i >= 0)
    const pos2Candidates = [
      bundle.search(/2\s*غرف/),
      bundle.search(/غرفتين/),
      text.search(/٢\s*غرف/),
    ].filter(i => i >= 0)
    const pos3 = pos3Candidates.length ? Math.min(...pos3Candidates) : -1
    const pos2 = pos2Candidates.length ? Math.min(...pos2Candidates) : -1
    if (pos3 >= 0 && (pos2 < 0 || pos3 < pos2)) return SHAKKA_3_ROOM_GRADIENT
    if (pos2 >= 0) return SHAKKA_2_ROOM_GRADIENT
  }

  const beds = unit.beds
  if (beds === 3) return SHAKKA_3_ROOM_GRADIENT
  if (beds === 2) return SHAKKA_2_ROOM_GRADIENT
  return null
}

// ─── Status colors ────────────────────────────────────────────────────────────

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#fbbf24',
    confirmed: '#10b981',
    checked_in: '#3b82f6',
    checked_out: '#6b7280',
    cancelled: '#ef4444',
    no_show: '#9ca3af',
  }
  return colors[status] || '#6b7280'
}

export function getStatusGradient(status: string): string {
  const gradients: Record<string, string> = {
    pending: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    confirmed: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    checked_in: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    checked_out: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    cancelled: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    no_show: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
  }
  return gradients[status] || gradients.checked_out
}

// ─── Unit type icons ──────────────────────────────────────────────────────────

export function getUnitTypeIcon(type: string) {
  const icons: Record<string, any> = {
    room: Home,
    suite: Hotel,
    chalet: Mountain,
    duplex: Layers,
    villa: Building,
  }
  return icons[type] || Building2
}

export function getUnitTypeIconData(type: string): { path: string; color: string; gradient: string } {
  const iconData: Record<string, { path: string; color: string; gradient: string }> = {
    room: {
      path: '<path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>',
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    },
    suite: {
      path: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L16 7l4-1l-1.5 6H5.5L4 6l4 1z"></path><path d="M5.5 12H18.5"></path><path d="M6 12v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3"></path>',
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    },
    chalet: {
      path: '<path d="M19 21h-8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2z"></path><path d="M7 8l4-4 4 4"></path><path d="M3 21h18"></path><path d="M7 21v-8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8"></path>',
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    },
    duplex: {
      path: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"></path><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"></path><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"></path>',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
    villa: {
      path: '<path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"></path><path d="M18 11V9a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"></path><path d="M14 10V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4"></path><path d="M10 6h4"></path><path d="M6 6h4"></path><path d="M6 10h4"></path><path d="M6 14h4"></path><path d="M10 14h4"></path><path d="M16 14h4"></path><path d="M18 18v3"></path><path d="M4 18v3"></path>',
      color: '#ef4444',
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    },
  }
  return iconData[type] || {
    path: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
    color: '#6b7280',
    gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
  }
}
