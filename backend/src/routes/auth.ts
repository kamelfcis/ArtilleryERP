import { Router } from 'express'
import { z } from 'zod'
import {
  changeUserPassword,
  clearAuthCookie,
  loginWithPassword,
  setAuthCookie,
  signToken,
} from '../services/authService.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات الدخول غير صالحة' })
      return
    }

    const result = await loginWithPassword(parsed.data.email, parsed.data.password)
    if (!result) {
      res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' })
      return
    }

    const token = signToken(result.user)
    setAuthCookie(res, token)
    res.json(result.me)
  } catch (err) {
    next(err)
  }
})

router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ success: true })
})

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات غير صالحة' })
      return
    }
    const result = await changeUserPassword(
      req.user!.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    )
    if (result === 'invalid') {
      res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' })
      return
    }
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: { id: req.user!.id, email: req.user!.email },
    roles: req.user!.roles,
    elevatedOps: req.user!.elevatedOps,
  })
})

export default router
