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

const num = (v, fallback = 0) => {
  if (v == null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export const normalizeLabour = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    name: raw.name ?? '',
    currentSite: raw.current_site ?? null,
    defaultAttendance: num(raw.default_attendance, 1),
    defaultSalary: num(raw.default_salary, 0),
    defaultFooding: num(raw.default_fooding, 0),
    lastSessionDate: raw.last_session_date ?? null,
    isActive: raw.is_active !== false,
    company: raw.company ?? null,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export const normalizeLabourList = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeLabour).filter(Boolean)
}

export const labourStatusLabel = (labour) => {
  if (!labour) return '—'
  if (!labour.isActive) return 'নিষ্ক্রিয়'
  return 'সক্রিয়'
}

export const labourStatusClass = (labour) => {
  if (!labour) return ''
  if (!labour.isActive) return 'badge-ghost'
  return 'badge-success'
}
