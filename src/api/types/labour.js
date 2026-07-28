/**
 * Labour / LabourList from /api/v1/labours
 */

import { z } from 'zod'

export const DEFAULT_ATTENDANCE_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3]

export const labourFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'নাম দিন')
    .max(255, 'নাম একটু ছোট করুন'),
  current_site: z.string().optional(),
  default_attendance: z.coerce.number({ message: 'ডিফল্ট হাজিরা নির্বাচন করুন' }),
  default_salary: z.coerce
    .number({ message: 'ডিফল্ট বেতন দিন' })
    .int('পূর্ণ সংখ্যা দিন')
    .min(0, 'বেতন ০ বা তার বেশি হতে হবে'),
  default_fooding: z.coerce
    .number({ message: 'ডিফল্ট খোরাকি দিন' })
    .int('পূর্ণ সংখ্যা দিন')
    .min(0, 'খোরাকি ০ বা তার বেশি হতে হবে'),
  is_active: z.boolean(),
})

export const toLabourPayload = ({
  name,
  current_site,
  default_attendance,
  default_salary,
  default_fooding,
  is_active,
}) => ({
  name: String(name ?? '').trim(),
  current_site:
    current_site === '' || current_site == null ? null : Number(current_site),
  default_attendance: Number(default_attendance),
  default_salary: Number(default_salary),
  default_fooding: Number(default_fooding),
  is_active: Boolean(is_active),
})

export const labourStatusLabel = (labour) => {
  if (!labour) return '—'
  if (!labour.is_active) return 'নিষ্ক্রিয়'
  return 'সক্রিয়'
}

export const labourStatusClass = (labour) => {
  if (!labour) return ''
  if (!labour.is_active) return 'badge-ghost'
  return 'badge-success'
}
