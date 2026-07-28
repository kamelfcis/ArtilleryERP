import { pool } from '../db/pool.js'

/** Best-effort audit row for admin deletes / sensitive actions. */
export async function writeAuditLog(opts: {
  userId: string
  action: string
  resourceType: string
  resourceId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [
        opts.userId,
        opts.action,
        opts.resourceType,
        opts.resourceId ?? null,
        opts.oldValues ? JSON.stringify(opts.oldValues) : null,
        opts.newValues ? JSON.stringify(opts.newValues) : null,
      ]
    )
  } catch (err) {
    console.error('[audit]', err)
  }
}
