/**
 * User / UserList from /api/v1/users
 * Create: name, phone_number, optional email (password system-generated).
 * Patch: name, email, phone_number, is_active.
 */

import { z } from 'zod'

const optionalEmail = z
  .string()
  .trim()
  .email('সঠিক ইমেইল দিন')
  .max(254)
  .optional()
  .or(z.literal(''))

export const userCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'নাম দিন')
    .max(255, 'নাম একটু ছোট করুন'),
  phone_number: z
    .string()
    .trim()
    .min(8, 'ফোন নম্বর দিন')
    .max(14, 'ফোন নম্বর একটু ছোট করুন'),
  email: optionalEmail,
})

export const userUpdateSchema = userCreateSchema.extend({
  is_active: z.boolean(),
})

export const toUserCreatePayload = ({ name, phone_number, email }) => ({
  name: String(name ?? '').trim(),
  phone_number: String(phone_number ?? '').trim(),
  email: email?.trim() ? email.trim() : null,
})

export const toUserUpdatePayload = ({
  name,
  phone_number,
  email,
  is_active,
}) => ({
  name: String(name ?? '').trim(),
  phone_number: String(phone_number ?? '').trim(),
  email: email?.trim() ? email.trim() : null,
  is_active: Boolean(is_active),
})

export const normalizeUser = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    name: raw.name ?? '',
    phoneNumber: raw.phone_number ?? '',
    email: raw.email ?? null,
    isActive: Boolean(raw.is_active),
    isCompanyAdmin: Boolean(raw.is_companyadmin),
    company: raw.company ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export const normalizeUserList = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeUser).filter(Boolean)
}

export const userStatusLabel = (user) => {
  if (!user) return '—'
  if (!user.isActive) return 'নিষ্ক্রিয়'
  if (user.isCompanyAdmin) return 'অ্যাডমিন'
  return 'সক্রিয়'
}

export const userStatusClass = (user) => {
  if (!user) return ''
  if (!user.isActive) return 'badge-ghost'
  if (user.isCompanyAdmin) return 'badge-info'
  return 'badge-success'
}
