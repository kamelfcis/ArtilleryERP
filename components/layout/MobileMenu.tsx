'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Menu, LogOut, ChevronDown, Database, Calculator, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/contexts/AuthContext'
import { menuItems, basicDataItems, accountingItems, settingsItems } from './Sidebar'

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const [basicOpen, setBasicOpen] = useState(false)
  const [accountingOpen, setAccountingOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const pathname = usePathname()
  const { hasAnyRole, signOut, user } = useAuth()

  const visibleItems = menuItems.filter(item => hasAnyRole(item.roles as any))
  const visibleBasic = basicDataItems.filter(item => hasAnyRole(item.roles as any))
  const visibleAccounting = accountingItems.filter(item => hasAnyRole(item.roles as any))
  const visibleSettings = settingsItems.filter(item => hasAnyRole(item.roles as any))

  const isInSection = (items: typeof menuItems) =>
    items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))

  function NavLink({ item, onClose }: { item: typeof menuItems[0]; onClose: () => void }) {
    const Icon = item.icon
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        <span>{item.title}</span>
      </Link>
    )
  }

  function SectionGroup({
    label,
    icon: SectionIcon,
    items,
    isOpen,
    setIsOpen,
  }: {
    label: string
    icon: typeof Database
    items: typeof menuItems
    isOpen: boolean
    setIsOpen: (v: boolean) => void
  }) {
    if (items.length === 0) return null
    const hasActive = isInSection(items)
    return (
      <Collapsible open={isOpen || hasActive} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            hasActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <SectionIcon className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1 text-right">{label}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', (isOpen || hasActive) && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-0.5 mt-0.5 pr-4">
          {items.map(item => (
            <NavLink key={item.href} item={item} onClose={() => setOpen(false)} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const mainItems = visibleItems.filter(item =>
    !basicDataItems.some(b => b.href === item.href) &&
    !accountingItems.some(a => a.href === item.href) &&
    !settingsItems.some(s => s.href === item.href)
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-slate-200 dark:ring-slate-700">
              <Image src="/logo.jpeg" alt="Logo" fill sizes="36px" className="object-cover" />
            </div>
            <div className="text-right">
              <div className="text-base font-bold">نظام الحجوزات</div>
              {user?.email && (
                <div className="text-xs font-normal text-muted-foreground truncate max-w-[160px]">{user.email}</div>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
          {mainItems.map(item => (
            <NavLink key={item.href} item={item} onClose={() => setOpen(false)} />
          ))}

          <SectionGroup label="الحسابات" icon={Calculator} items={visibleAccounting} isOpen={accountingOpen} setIsOpen={setAccountingOpen} />
          <SectionGroup label="البيانات الأساسية" icon={Database} items={visibleBasic} isOpen={basicOpen} setIsOpen={setBasicOpen} />
          <SectionGroup label="الإعدادات" icon={Settings} items={visibleSettings} isOpen={settingsOpen} setIsOpen={setSettingsOpen} />
        </nav>

        <div className="border-t p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={() => { setOpen(false); signOut() }}
          >
            <LogOut className="h-5 w-5" />
            <span>تسجيل الخروج</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
