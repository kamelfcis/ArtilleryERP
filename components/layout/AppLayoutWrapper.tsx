'use client'

import { usePathname } from 'next/navigation'
import { DashboardLayout } from './DashboardLayout'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { SidebarProvider } from '@/contexts/SidebarContext'

export function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isCalendarPage = pathname === '/calendar'
  
  // Don't show sidebar on login or modules page
  if (pathname === '/login' || pathname === '/modules') {
    return <>{children}</>
  }
  
  // Show DashboardLayout with Sidebar for all other pages
  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager', 'Receptionist', 'Staff']}>
      <SidebarProvider initialCollapsed={isCalendarPage}>
        <DashboardLayout>{children}</DashboardLayout>
      </SidebarProvider>
    </RoleGuard>
  )
}

