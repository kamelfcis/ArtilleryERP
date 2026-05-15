'use client'

import { useState } from 'react'
import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Home,
  Users,
  Wifi,
  DollarSign,
  BarChart3,
  UserCog,
  LogOut,
  Settings,
  Wrench,
  Shield,
  Repeat,
  Tag,
  Sparkles,
  Mail,
  Package,
  Activity,
  Server,
  Utensils,
  History,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Database,
  MapPin,
  Calculator,
  ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// Basic lookup data items (البيانات الأساسية)
const basicDataItems = [
  {
    title: 'المواقع',
    href: '/locations',
    icon: MapPin,
    roles: ['SuperAdmin'],
  },
  {
    title: 'الوحدات',
    href: '/units',
    icon: Home,
    roles: ['SuperAdmin', 'Receptionist', 'Staff'],
  },
  {
    title: 'الضيوف',
    href: '/guests',
    icon: Users,
    roles: ['SuperAdmin', 'Receptionist', 'Staff'],
  },
  {
    title: 'المرافق',
    href: '/facilities',
    icon: Wifi,
    roles: ['SuperAdmin'],
  },
  {
    title: 'الأسعار',
    href: '/pricing',
    icon: DollarSign,
    roles: ['SuperAdmin'],
  },
  {
    title: 'أكواد الخصم',
    href: '/discounts',
    icon: Tag,
    roles: ['SuperAdmin'],
  },
  {
    title: 'الموظفين',
    href: '/staff',
    icon: Users,
    roles: ['SuperAdmin'],
  },
  {
    title: 'المخزون',
    href: '/inventory',
    icon: Package,
    roles: ['SuperAdmin'],
  },
]

// Accounting items (الحسابات)
const accountingItems = [
  {
    title: 'المصالحة المالية',
    href: '/financial/reconciliation',
    icon: DollarSign,
    roles: ['SuperAdmin'],
  },
  {
    title: 'التقارير',
    href: '/reports',
    icon: BarChart3,
    roles: ['SuperAdmin'],
  },
  {
    title: 'تقارير الخدمات',
    href: '/services/reports',
    icon: BarChart3,
    roles: ['SuperAdmin', 'Accountant'],
  },
  {
    title: 'تحليلات الخدمات',
    href: '/services/analytics',
    icon: BarChart3,
    roles: ['SuperAdmin', 'Accountant'],
  },
  {
    title: 'تكاليف الخدمات',
    href: '/services/costs',
    icon: DollarSign,
    roles: ['SuperAdmin'],
  },
]

// Settings items (الإعدادات)
const settingsItems = [
  {
    title: 'المستخدمين',
    href: '/users',
    icon: UserCog,
    roles: ['SuperAdmin'],
  },
  {
    title: 'الإعدادات',
    href: '/settings',
    icon: Settings,
    roles: ['SuperAdmin'],
  },
  {
    title: 'قوالب البريد',
    href: '/email-templates',
    icon: Mail,
    roles: ['SuperAdmin'],
  },
  {
    title: 'سجل التدقيق',
    href: '/audit-logs',
    icon: Shield,
    roles: ['SuperAdmin', 'Receptionist', 'Staff'],
  },
  {
    title: 'سجل الأنشطة',
    href: '/activity',
    icon: Activity,
    roles: ['SuperAdmin'],
  },
  {
    title: 'صحة النظام',
    href: '/system/health',
    icon: Server,
    roles: ['SuperAdmin'],
  },
]

const menuItems = [
  {
    title: 'لوحة التحكم',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff'],
  },
  {
    title: 'التقويم',
    href: '/calendar',
    icon: Calendar,
    roles: ['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff'],
  },
  {
    title: 'الحجوزات',
    href: '/reservations',
    icon: FileText,
    roles: ['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff'],
  },
  {
    title: 'طلبات الحجز',
    href: '/pending-reservations',
    icon: ClipboardCheck,
    roles: ['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff'],
  },
  {
    title: 'حجوزات متكررة',
    href: '/reservations/recurring',
    icon: Calendar,
    roles: ['SuperAdmin', 'Receptionist'],
  },
  {
    title: 'حظر الوحدات',
    href: '/room-blocks',
    icon: Calendar,
    roles: ['SuperAdmin', 'Receptionist'],
  },
  {
    title: 'الصيانة',
    href: '/maintenance',
    icon: Wrench,
    roles: ['SuperAdmin'],
  },
  {
    title: 'النظافة',
    href: '/housekeeping',
    icon: Sparkles,
    roles: ['SuperAdmin'],
  },
  {
    title: 'الخدمات والطعام',
    href: '/services',
    icon: Utensils,
    roles: ['SuperAdmin', 'Accountant'],
  },
  {
    title: 'باقات الخدمات',
    href: '/services/bundles',
    icon: Package,
    roles: ['SuperAdmin', 'Accountant'],
  },
  {
    title: 'سجل الخدمات',
    href: '/services/history',
    icon: History,
    roles: ['SuperAdmin', 'Accountant'],
  },
  {
    title: 'جدولة التوفر',
    href: '/services/availability',
    icon: Calendar,
    roles: ['SuperAdmin'],
  },
  {
    title: 'مخزون الخدمات',
    href: '/services/stock',
    icon: Package,
    roles: ['SuperAdmin'],
  },
]

// Export menuItems for use in MobileMenu
export { menuItems, basicDataItems, accountingItems, settingsItems }

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps = {}) {
  const pathname = usePathname()
  const { hasAnyRole, signOut } = useAuth()
  const [isBasicDataOpen, setIsBasicDataOpen] = useState(false)
  const [isAccountingOpen, setIsAccountingOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const visibleItems = menuItems.filter(item =>
    hasAnyRole(item.roles as any)
  )

  const visibleBasicDataItems = basicDataItems.filter(item =>
    hasAnyRole(item.roles as any)
  )

  const visibleAccountingItems = accountingItems.filter(item =>
    hasAnyRole(item.roles as any)
  )

  const visibleSettingsItems = settingsItems.filter(item =>
    hasAnyRole(item.roles as any)
  )

  // Check if any item is active to auto-open the collapsible
  const hasActiveBasicData = visibleBasicDataItems.some(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  const hasActiveAccounting = visibleAccountingItems.some(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  const hasActiveSettings = visibleSettingsItems.some(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  )

  // Auto-open if any item is active
  React.useEffect(() => {
    if (hasActiveBasicData) {
      setIsBasicDataOpen(true)
    }
  }, [hasActiveBasicData])

  React.useEffect(() => {
    if (hasActiveAccounting) {
      setIsAccountingOpen(true)
    }
  }, [hasActiveAccounting])

  React.useEffect(() => {
    if (hasActiveSettings) {
      setIsSettingsOpen(true)
    }
  }, [hasActiveSettings])

  return (
    <div className={`flex h-screen flex-col border-l bg-background mobile-hidden transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className={`flex h-16 items-center ${collapsed ? 'justify-center' : 'justify-center gap-3'} border-b px-4 relative`}>
        {!collapsed && (
          <>
            <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-slate-200 dark:ring-slate-700 flex-shrink-0">
              <Image
                src="/logo.jpeg"
                alt="Logo"
                width={40}
                height={40}
                className="object-cover w-full h-full"
                style={{ width: 'auto', height: 'auto' }}
                priority
              />
            </div>
            <h1 className="text-xl font-bold">نظام الحجوزات</h1>
          </>
        )}
        {collapsed && (
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-slate-200 dark:ring-slate-700 flex-shrink-0">
            <Image
              src="/logo.jpeg"
              alt="Logo"
              width={40}
              height={40}
              className="object-cover w-full h-full"
              style={{ width: 'auto', height: 'auto' }}
              priority
            />
          </div>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className={`absolute ${collapsed ? 'right-1' : 'left-1'} top-1/2 -translate-y-1/2 h-8 w-8`}
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {visibleItems.map((item) => {
          // Skip items that are in collapsible sections
          const isBasicDataItem = basicDataItems.some(basicItem => basicItem.href === item.href)
          const isAccountingItem = accountingItems.some(accItem => accItem.href === item.href)
          const isSettingsItem = settingsItems.some(setItem => setItem.href === item.href)
          if (isBasicDataItem || isAccountingItem || isSettingsItem) return null

          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={collapsed ? item.title : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          )
        })}

        {/* Accounting Collapsible Section */}
        {visibleAccountingItems.length > 0 && !collapsed && (
          <Collapsible open={isAccountingOpen} onOpenChange={setIsAccountingOpen}>
            <CollapsibleTrigger
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                hasActiveAccounting
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Calculator className="h-5 w-5" />
              <span className="flex-1 text-right">الحسابات</span>
              {isAccountingOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1 pr-8">
              {visibleAccountingItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Basic Data Collapsible Section */}
        {visibleBasicDataItems.length > 0 && !collapsed && (
          <Collapsible open={isBasicDataOpen} onOpenChange={setIsBasicDataOpen}>
            <CollapsibleTrigger
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                hasActiveBasicData
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Database className="h-5 w-5" />
              <span className="flex-1 text-right">البيانات الأساسية</span>
              {isBasicDataOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1 pr-8">
              {visibleBasicDataItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Settings Collapsible Section */}
        {visibleSettingsItems.length > 0 && !collapsed && (
          <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <CollapsibleTrigger
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                hasActiveSettings
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Settings className="h-5 w-5" />
              <span className="flex-1 text-right">الإعدادات</span>
              {isSettingsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1 pr-8">
              {visibleSettingsItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </nav>
      <div className="border-t p-4">
        {!collapsed && <InstallPromptLazy />}
        <Button
          variant="ghost"
          className={cn(
            'w-full',
            collapsed ? 'justify-center' : 'justify-start'
          )}
          onClick={signOut}
          title={collapsed ? 'تسجيل الخروج' : undefined}
        >
          <LogOut className={cn('h-4 w-4', !collapsed && 'mr-2')} />
          {!collapsed && <span>تسجيل الخروج</span>}
        </Button>
      </div>
    </div>
  )
}

// Lazy-load to avoid SSR issues with navigator.onLine / beforeinstallprompt.
function InstallPromptLazy() {
  const [Comp, setComp] = React.useState<React.ComponentType | null>(null)
  React.useEffect(() => {
    import('@/components/offline/InstallPrompt').then(m => setComp(() => m.InstallPrompt))
  }, [])
  if (!Comp) return null
  return <Comp />
}

