import { isApiProvider } from './data-provider'
import { apiGet } from './http-client'
import { fetchWithSupabaseAuth } from './fetch-with-supabase-auth'

export type AdminUserRow = { id: string; email: string; is_active?: boolean }

/** List auth users (SuperAdmin or any authenticated user per Next.js route policy). */
export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  if (isApiProvider()) {
    const json = await apiGet<{ users: AdminUserRow[] }>('/admin/users')
    return json.users ?? []
  }
  const res = await fetchWithSupabaseAuth('/api/admin/users')
  if (!res.ok) return []
  const json = await res.json()
  return (json.users ?? []) as AdminUserRow[]
}
