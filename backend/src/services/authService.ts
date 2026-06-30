import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import { config } from '../config.js'
import { pool } from '../db/pool.js'
import {
  buildMeResponse,
  isAccountActive,
  type AuthUser,
  type MeResponse,
} from './userService.js'

const BCRYPT_ROUNDS = 10

export interface LoginResult {
  user: AuthUser
  me: MeResponse
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<LoginResult | null> {
  const normalized = email.trim().toLowerCase()
  const { rows } = await pool.query<{
    id: string
    email: string
    encrypted_password: string | null
  }>(
    `SELECT id, email, encrypted_password
     FROM auth.users
     WHERE lower(email) = $1
     LIMIT 1`,
    [normalized]
  )

  const row = rows[0]
  if (!row?.encrypted_password) return null

  const valid = await bcrypt.compare(password, row.encrypted_password)
  if (!valid) return null

  const active = await isAccountActive(row.id)
  if (!active) {
    throw new Error('ACCOUNT_DISABLED')
  }

  const me = await buildMeResponse(row.id, row.email)
  return { user: me.user, me }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: '7d',
  })
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload
    if (!payload.sub || typeof payload.sub !== 'string') return null
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
    }
  } catch {
    return null
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    path: '/',
  })
}

/** Hash a plaintext password (for future password-change endpoints). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}
