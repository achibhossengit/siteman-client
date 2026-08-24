/**
 * Labour / LabourList from /api/v1/labours
 */

import { z } from 'zod'
import { STATUS_LABEL } from '../../utils/format.js'

/** Default হাজিরা options for labour create/update (min 1). */
export const DEFAULT_ATTENDANCE_OPTIONS = [1, 1.5, 2, 2.5, 3]

export const LABOUR_FORM_DEFAULTS = {
  name: '',
  current_site: '',
  default_attendance: 1,
  default_salary: 500,
  default_fooding: 200,
  is_active: true,
}

/**
 * @param {{ requireSite?: boolean }} [options]
 * Non–company-admin users must pick a current site.
 */
export const createLabourFormSchema = ({ requireSite = false } = {}) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, 'নাম দিন')
      .max(255, 'নাম একটু ছোট করুন'),
    current_site: requireSite
      ? z.string().trim().min(1, 'সাইট নির্বাচন করুন')
      : z.string().optional(),
    default_attendance: z.coerce
      .number({ message: 'হাজিরা নির্বাচন করুন' })
      .min(1, 'হাজিরা কমপক্ষে ১ হতে হবে'),
    default_salary: z.coerce
      .number({ message: 'বেতন দিন' })
      .int('পূর্ণ সংখ্যা দিন')
      .gt(0, 'বেতন শূন্যের বেশি হতে হবে'),
    default_fooding: z.coerce
      .number({ message: 'খোরাকি দিন' })
      .int('পূর্ণ সংখ্যা দিন')
      .min(0, 'খোরাকি ০ বা তার বেশি হতে হবে'),
    is_active: z.boolean(),
  })

/** Default schema (site optional) — prefer createLabourFormSchema for role-aware forms. */
export const labourFormSchema = createLabourFormSchema()

export const toLabourPayload = ({
  name,
  current_site,
  default_attendance,
  default_salary,
  default_fooding,
  is_active,
  photoFile,
  removePhoto,
}) => {
  const fields = {
    name: String(name ?? '').trim(),
    current_site:
      current_site === '' || current_site == null ? null : Number(current_site),
    default_attendance: Number(default_attendance),
    default_salary: Number(default_salary),
    default_fooding: Number(default_fooding),
    is_active: Boolean(is_active),
  }

  if (photoFile instanceof File) {
    const form = new FormData()
    form.append('name', fields.name)
    form.append(
      'current_site',
      fields.current_site == null ? '' : String(fields.current_site),
    )
    form.append('default_attendance', String(fields.default_attendance))
    form.append('default_salary', String(fields.default_salary))
    form.append('default_fooding', String(fields.default_fooding))
    form.append('is_active', fields.is_active ? 'true' : 'false')
    form.append('photo', photoFile)
    return form
  }

  if (removePhoto) return { ...fields, photo: null }
  return fields
}

export const labourStatusLabel = (labour) => {
  if (!labour) return '—'
  if (!labour.is_active) return STATUS_LABEL.inactive
  return STATUS_LABEL.active
}

export const labourStatusClass = (labour) => {
  if (!labour) return ''
  if (!labour.is_active) return 'badge-ghost'
  return 'badge-success'
}

/** Normalize attendance to a selectable option (min 1). */
export const normalizeDefaultAttendance = (value) => {
  const n = Number(value)
  if (DEFAULT_ATTENDANCE_OPTIONS.includes(n)) return n
  const next = DEFAULT_ATTENDANCE_OPTIONS.find((opt) => opt >= n)
  return next ?? 1
}
