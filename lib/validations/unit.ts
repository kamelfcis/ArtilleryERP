import { z } from 'zod'

export const unitSchema = z.object({
  location_id: z.string().min(1, 'يجب اختيار موقع'),
  unit_number: z.string().min(1, 'يجب إدخال رقم الوحدة'),
  name: z.string().optional(),
  name_ar: z.string().optional(),
  type: z.enum(['room', 'suite', 'chalet', 'duplex', 'villa', 'apartment']),
  status: z.enum(['available', 'occupied', 'maintenance', 'out_of_order']).default('available'),
  capacity: z.number().min(1, 'يجب أن تكون السعة على الأقل 1'),
  beds: z.number().min(1).default(1),
  bathrooms: z.number().min(1).default(1),
  area_sqm: z.number().optional(),
  description: z.string().optional(),
  description_ar: z.string().optional(),
  orderno: z.number().optional(),
  is_active: z.boolean().default(true),
})

export type UnitFormData = z.infer<typeof unitSchema>

