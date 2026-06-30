import type { UserRole } from '../services/userService.js'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        roles: UserRole[]
        elevatedOps: boolean
      }
    }
  }
}

export {}
