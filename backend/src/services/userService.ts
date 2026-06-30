export type UserRole =
  | 'SuperAdmin'
  | 'BranchManager'
  | 'Receptionist'
  | 'Staff'
  | 'Viewer'

export interface AuthUser {
  id: string
  email: string
}

export interface MeResponse {
  user: AuthUser
  roles: UserRole[]
  elevatedOps: boolean
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const { pool } = await import('../db/pool.js')
  const { rows } = await pool.query<{ name: UserRole }>(
    `SELECT r.name
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  )
  return rows.map((r) => r.name).filter(Boolean)
}

export async function getElevatedOps(userId: string): Promise<boolean> {
  const { pool } = await import('../db/pool.js')
  const { rows } = await pool.query<{ elevated_ops: boolean }>(
    `SELECT elevated_ops FROM user_privileges WHERE user_id = $1`,
    [userId]
  )
  return rows[0]?.elevated_ops === true
}

export async function userHasAnyRole(
  userId: string,
  roleNames: UserRole[]
): Promise<boolean> {
  const roles = await getUserRoles(userId)
  return roleNames.some((r) => roles.includes(r))
}

export async function isAccountActive(userId: string): Promise<boolean> {
  const { pool } = await import('../db/pool.js')
  const { rows } = await pool.query<{ is_active: boolean | null }>(
    `SELECT is_active FROM user_accounts WHERE user_id = $1`,
    [userId]
  )
  if (rows.length === 0) return true
  return rows[0].is_active !== false
}

export async function buildMeResponse(userId: string, email: string): Promise<MeResponse> {
  const [roles, elevatedOps] = await Promise.all([
    getUserRoles(userId),
    getElevatedOps(userId),
  ])
  return {
    user: { id: userId, email },
    roles,
    elevatedOps,
  }
}
