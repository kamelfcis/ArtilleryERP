'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Calendar,
  Users,
  Home,
  FileText,
  Search,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function QuickActions() {
  const router = useRouter()

  const actions = [
    {
      label: 'حجز جديد',
      icon: Plus,
      onClick: () => router.push('/reservations/new'),
    },
    {
      label: 'ضيف جديد',
      icon: Users,
      onClick: () => router.push('/guests/new'),
    },
    {
      label: 'وحدة جديدة',
      icon: Home,
      onClick: () => router.push('/units/new'),
    },
    {
      label: 'التقويم',
      icon: Calendar,
      onClick: () => router.push('/calendar'),
    },
    {
      label: 'البحث',
      icon: Search,
      onClick: () => {
        const searchInput = document.querySelector('input[placeholder*="ابحث"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      },
    },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          إجراءات سريعة
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <DropdownMenuItem key={action.label} onClick={action.onClick}>
              <Icon className="mr-2 h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

