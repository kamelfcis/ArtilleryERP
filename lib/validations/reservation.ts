import { z } from 'zod'

export const reservationSchema = z.object({
  unit_id: z.string().min(1, 'يجب اختيار وحدة'),
  guest_id: z.string().min(1, 'يجب اختيار ضيف'),
  check_in_date: z.string().min(1, 'يجب اختيار تاريخ الدخول'),
  check_out_date: z.string().min(1, 'يجب اختيار تاريخ الخروج'),
  status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
  source: z.enum(['online', 'phone', 'walk_in', 'email']).default('phone'),
  adults: z.number().min(1, 'يجب أن يكون عدد البالغين على الأقل 1'),
  children: z.number().min(0).default(0),
  total_amount: z.number().min(0, 'يجب أن يكون المبلغ أكبر من أو يساوي 0'),
  paid_amount: z.number().min(0).default(0),
  discount_amount: z.number().min(0).default(0),
  notes: z.string().optional(),
  notes_ar: z.string().optional(),
}).refine((data) => {
  const checkIn = new Date(data.check_in_date)
  const checkOut = new Date(data.check_out_date)
  return checkOut > checkIn
}, {
  message: 'تاريخ الخروج يجب أن يكون بعد تاريخ الدخول',
  path: ['check_out_date'],
})

export type ReservationFormData = z.infer<typeof reservationSchema>

