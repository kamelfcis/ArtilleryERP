import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'طلب غير صالح', details: err.flatten() })
    return
  }

  if (err instanceof Error && err.message === 'ACCOUNT_DISABLED') {
    res.status(403).json({
      error: 'تم تعطيل حسابك. يرجى التواصل مع مدير النظام.',
    })
    return
  }

  console.error('[api]', err)
  res.status(500).json({ error: 'حدث خطأ في الخادم' })
}
