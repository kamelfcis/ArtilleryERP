import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'
import { getTokenVersion, verifyToken } from '../services/authService.js'
import { buildMeResponse, isAccountActive } from '../services/userService.js'

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[config.cookieName]
  if (!token) {
    res.status(401).json({ error: 'غير مصرح' })
    return
  }

  const basic = verifyToken(token)
  if (!basic) {
    res.status(401).json({ error: 'جلسة غير صالحة' })
    return
  }

  try {
    const active = await isAccountActive(basic.id)
    if (!active) {
      res.status(401).json({ error: 'الحساب معطل' })
      return
    }

    const currentTv = await getTokenVersion(basic.id)
    if (basic.tokenVersion !== currentTv) {
      res.status(401).json({ error: 'جلسة غير صالحة — يرجى تسجيل الدخول مجدداً' })
      return
    }

    const me = await buildMeResponse(basic.id, basic.email)
    req.user = {
      id: me.user.id,
      email: me.user.email,
      roles: me.roles,
      elevatedOps: me.elevatedOps,
    }
    next()
  } catch (err) {
    console.error('[auth]', err)
    res.status(401).json({ error: 'جلسة غير صالحة' })
  }
}
