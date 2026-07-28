/** Safe SQL identifier: letters, digits, underscore; must start with letter or underscore. */
const IDENT_RE = /^[a-z_][a-z0-9_]*$/i

export function assertSafeIdentifier(key: string): void {
  if (!IDENT_RE.test(key)) {
    throw new Error(`Invalid SQL identifier: ${key}`)
  }
}

export function pickFields(
  body: Record<string, unknown>,
  allowed: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      out[key] = body[key]
    }
  }
  return out
}

/**
 * Build SET clause for parameterized UPDATE.
 * Prefer passing `allowed` (or call pickFields first). Every key is validated.
 */
export function buildUpdateSet(
  data: Record<string, unknown>,
  startIndex = 1,
  allowed?: readonly string[]
): { setClause: string; values: unknown[] } | null {
  const source = allowed ? pickFields(data, allowed) : data
  const entries = Object.entries(source).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return null

  const values: unknown[] = []
  const parts: string[] = []
  let idx = startIndex

  for (const [key, value] of entries) {
    assertSafeIdentifier(key)
    if (allowed && !allowed.includes(key)) {
      throw new Error(`Field not allowed: ${key}`)
    }
    parts.push(`${key} = $${idx}`)
    values.push(value)
    idx++
  }

  return { setClause: parts.join(', '), values }
}

/** Build INSERT column list + placeholders from an allowlisted body. */
export function buildInsert(
  data: Record<string, unknown>,
  allowed: readonly string[]
): { columns: string; placeholders: string; values: unknown[] } | null {
  const body = pickFields(data, allowed)
  const keys = Object.keys(body).filter((k) => body[k] !== undefined)
  if (keys.length === 0) return null
  for (const k of keys) assertSafeIdentifier(k)
  return {
    columns: keys.join(', '),
    placeholders: keys.map((_, i) => `$${i + 1}`).join(', '),
    values: keys.map((k) => body[k]),
  }
}
