import { z } from 'zod'
import { ROLE_NAMES, groupLabelBn } from '../../utils/permissions.js'

const requiredEmail = z
  .string()
  .trim()
  .min(1, 'ইমেইল দিন')
  .email('সঠিক ইমেইল দিন')
  .max(254)

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
  email: requiredEmail,
})

/** Admin user PATCH — only is_active + assignment replace. */
export const userAdminUpdateSchema = z.object({
  is_active: z.boolean(),
  groups: z.array(z.string().min(1)),
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
  groups: (groups ?? [])
    .map((g) => String(g ?? '').trim())
    .filter(Boolean),
  sites: (sites ?? []).map((id) => Number(id)),
})

export const toProfileUpdatePayload = ({ name, phone_number, email }) => ({
  name: String(name ?? '').trim(),
  phone_number: String(phone_number ?? '').trim(),
  email: email?.trim() ? email.trim() : null,
})

/** Normalize API groups (objects or names) → string[]. */
export const normalizeGroupNames = (groups) =>
  (Array.isArray(groups) ? groups : [])
    .map((g) => {
      if (typeof g === 'string') return g.trim()
      if (g && typeof g === 'object' && g.name != null) return String(g.name).trim()
      return ''
    })
    .filter(Boolean)

/** Normalize API sites (objects or ids) → number[]. */
export const normalizeSiteIds = (sites) =>
  (Array.isArray(sites) ? sites : [])
    .map((s) => (typeof s === 'object' && s != null ? s.id : s))
    .filter((id) => id != null && id !== '')
    .map(Number)

/** Fixed role options — PATCH assigns by English group name. */
export const buildAssignableGroups = () =>
  ASSIGNABLE_GROUP_NAMES.map((name) => ({
    name,
    label: groupLabelBn(name),
  }))

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
