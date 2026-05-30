export interface BookingNotificationLike {
  created_by: string
  notify_user_id?: string | null
}

export interface BookingNotificationFilterContext {
  restrictedBranchManager: boolean
  viewerId?: string
  rocketUserId: string | null
}

export function shouldShowBookingNotification(
  notif: BookingNotificationLike,
  ctx: BookingNotificationFilterContext
): boolean {
  if (ctx.restrictedBranchManager) {
    return notif.notify_user_id === ctx.viewerId
  }
  if (notif.notify_user_id) return false
  if (!ctx.rocketUserId) return false
  return notif.created_by === ctx.rocketUserId
}
