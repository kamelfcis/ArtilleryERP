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

export interface TokenPayload extends AuthUser {
  tokenVersion: number
}

export async function getTokenVersion(userId: string): Promise<number> {
  const { rows } = await pool.query<{ token_version: number | null }>(
    `SELECT token_version FROM user_accounts WHERE user_id = $1 LIMIT 1`,
    [userId]
  )
  if (rows.length === 0) return 0
  return rows[0].token_version ?? 0
}

export async function bumpTokenVersion(userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_accounts (user_id, is_active, token_version)
     VALUES ($1, true, 1)
     ON CONFLICT (user_id) DO UPDATE
       SET token_version = COALESCE(user_accounts.token_version, 0) + 1,
           updated_at = now()`,
    [userId]
  )
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

export async function signToken(user: AuthUser): Promise<string> {
  const tokenVersion = await getTokenVersion(user.id)
  return jwt.sign(
    { sub: user.id, email: user.email, tv: tokenVersion },
    config.jwtSecret,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload
    if (!payload.sub || typeof payload.sub !== 'string') return null
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
      tokenVersion: typeof payload.tv === 'number' ? payload.tv : 0,
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

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

/**
 * Verify the user's current password and set a new one.
 * Bumps token_version so existing JWTs become invalid.
 */
export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<'ok' | 'invalid'> {
  const { rows } = await pool.query<{ encrypted_password: string | null }>(
    `SELECT encrypted_password FROM auth.users WHERE id = $1 LIMIT 1`,
    [userId]
  )
  const enc = rows[0]?.encrypted_password
  if (!enc) return 'invalid'
  const valid = await bcrypt.compare(currentPassword, enc)
  if (!valid) return 'invalid'
  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await pool.query(
    `UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2`,
    [hashed, userId]
  )
  await bumpTokenVersion(userId)
  return 'ok'
}
