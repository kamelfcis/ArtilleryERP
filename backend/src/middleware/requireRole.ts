import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '../services/userService.js'

export function requireAnyRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' })
      return
    }

    const hasRole = allowedRoles.some((role) => req.user!.roles.includes(role))
    if (!hasRole) {
      res.status(403).json({ error: 'غير مصرح' })
      return
    }

    next()
  }
}
