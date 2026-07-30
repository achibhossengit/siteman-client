/**
 * User / UserList from /api/v1/users
 * Create: name, phone_number, optional email (password system-generated).
 * Admin PATCH: is_active, groups[{id}], sites[id] (replaces assignments).
 * Profile PATCH: name, email, phone_number.
 */

import { z } from 'zod'
import { ROLE_NAMES } from '../../utils/permissions.js'

const optionalEmail = z
  .string()
  .trim()
  .email('সঠিক ইমেইল দিন')
  .max(254)
  .optional()
  .or(z.literal(''))

export const ASSIGNABLE_GROUP_NAMES = [
  ROLE_NAMES.companyAdmin,
  ROLE_NAMES.siteManager,
  ROLE_NAMES.siteAuditor,
]

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

/** Admin user PATCH — only is_active + assignment replace. */
export const userAdminUpdateSchema = z.object({
  is_active: z.boolean(),
  groups: z.array(z.number().int()),
  sites: z.array(z.number().int()),
})

export const profileUpdateSchema = userCreateSchema

export const toUserCreatePayload = ({ name, phone_number, email }) => ({
  name: String(name ?? '').trim(),
  phone_number: String(phone_number ?? '').trim(),
  email: email?.trim() ? email.trim() : null,
})

export const toUserAdminUpdatePayload = ({ is_active, groups, sites }) => ({
  is_active: Boolean(is_active),
  groups: (groups ?? []).map((id) => ({ id: Number(id) })),
  sites: (sites ?? []).map((id) => Number(id)),
})

export const toProfileUpdatePayload = ({ name, phone_number, email }) => ({
  name: String(name ?? '').trim(),
  phone_number: String(phone_number ?? '').trim(),
  email: email?.trim() ? email.trim() : null,
})

/** Normalize API groups (objects or ids) → number[]. */
export const normalizeGroupIds = (groups) =>
  (Array.isArray(groups) ? groups : [])
    .map((g) => (typeof g === 'object' && g != null ? g.id : g))
    .filter((id) => id != null && id !== '')
    .map(Number)

/** Normalize API sites (objects or ids) → number[]. */
export const normalizeSiteIds = (sites) =>
  (Array.isArray(sites) ? sites : [])
    .map((s) => (typeof s === 'object' && s != null ? s.id : s))
    .filter((id) => id != null && id !== '')
    .map(Number)

/**
 * Build { id, name } options for the three assignable roles.
 * IDs are discovered from any known group lists (no public catalog endpoint).
 */
export const buildAssignableGroups = (...groupLists) => {
  const byName = new Map()
  for (const list of groupLists) {
    for (const g of Array.isArray(list) ? list : []) {
      if (g?.name && g?.id != null) byName.set(g.name, Number(g.id))
    }
  }
  return ASSIGNABLE_GROUP_NAMES.map((name) => ({
    name,
    id: byName.get(name) ?? null,
  }))
}

export const userStatusLabel = (user) => {
  if (!user) return '—'
  if (!user.is_active) return 'নিষ্ক্রিয়'
  return 'সক্রিয়'
}

export const userStatusClass = (user) => {
  if (!user) return ''
  if (!user.is_active) return 'badge-ghost'
  return 'badge-success'
}
