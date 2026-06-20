import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, safeSupabaseCall } from '@/lib/supabase/admin-server'
import { getVerifiedAuthUser } from '@/lib/api/verified-auth-user'
import { UserRole } from '@/lib/types/database'

export async function userHasAnyRole(
  userId: string,
  roleNames: UserRole[]
): Promise<boolean> {
  const admin = createAdminClient()

  const { data: userRoles } = await safeSupabaseCall(() =>
    admin.from('user_roles').select('role_id').eq('user_id', userId)
  )

  if (!userRoles?.length) return false

  const roleIds = userRoles.map((row) => row.role_id).filter(Boolean)
  if (!roleIds.length) return false

  const { data: roles } = await safeSupabaseCall(() =>
    admin.from('roles').select('name').in('id', roleIds)
  )

  const names = new Set((roles ?? []).map((row) => row.name))
  return roleNames.some((role) => names.has(role))
}

export async function requireAnyRole(
  request: NextRequest,
  roleNames: UserRole[]
): Promise<{ id: string } | NextResponse> {
  const authed = await getVerifiedAuthUser(request)
  if (!authed) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const allowed = await userHasAnyRole(authed.id, roleNames)
  if (!allowed) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  }

  return authed
}
