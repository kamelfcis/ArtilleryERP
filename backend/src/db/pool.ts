import pg from 'pg'
import { config } from '../config.js'

const { Pool } = pg

// Keep DATE columns as "YYYY-MM-DD" strings (avoid JS Date / TZ shifts).
pg.types.setTypeParser(1082, (val: string) => val)

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

export async function pingDb(): Promise<boolean> {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
    return true
  } finally {
    client.release()
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params)
}
