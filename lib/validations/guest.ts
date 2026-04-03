import { z } from 'zod'

// Helper to handle null values from database
const nullableString = z.string().nullable().optional().transform(val => val ?? '')

export const guestSchema = z.object({
  first_name: z.string().min(1, 'يجب إدخال الاسم الأول'),
  last_name: z.string().min(1, 'يجب إدخال اسم العائلة'),
  first_name_ar: nullableString,
  last_name_ar: nullableString,
  email: z.string().email('البريد الإلكتروني غير صحيح').nullable().optional().or(z.literal('')).transform(val => val ?? ''),
  phone: z.string().min(1, 'يجب إدخال رقم الهاتف'),
  national_id: nullableString,
  military_rank: nullableString,
  military_rank_ar: nullableString,
  unit: nullableString,
  unit_ar: nullableString,
  guest_type: z.preprocess(
    (val) => val ?? 'military',
    z.enum(['military', 'civilian', 'club_member', 'artillery_family'])
  ),
  notes: nullableString,
})

export type GuestFormData = z.infer<typeof guestSchema>
