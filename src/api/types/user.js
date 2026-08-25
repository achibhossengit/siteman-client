import { z } from 'zod'
import { ROLE_NAMES, groupLabelBn } from '../../utils/permissions.js'
import { STATUS_LABEL } from '../../utils/format.js'
import { bdPhoneNumberSchema } from '../../utils/phone.js'

const optionalEmail = z
  .string()
  .trim()
  .max(254, 'ইমেইল একটু ছোট করুন')
  .refine(
    (value) => value === '' || z.string().email().safeParse(value).success,
    { message: 'সঠিক ইমেইল দিন' },
  )

/** Matches Django password validators used by the API. */
export const passwordCreateSchema = z
  .string()
  .min(8, 'পাসওয়ার্ডটি আরও একটু লম্বা হলে ভালো হয়।')
  .max(20, 'পাসওয়ার্ড সর্বোচ্চ ২০ অক্ষরের হতে পারে')
  .refine((value) => !/^\d+$/.test(value), {
    message: 'শুধু সংখ্যা দিয়ে পাসওয়ার্ড করা যাবে না। অক্ষরও যোগ করুন।',
  })

/** Groups that can be newly assigned (Company Admin is not assignable). */
export const ASSIGNABLE_GROUP_NAMES = [
  ROLE_NAMES.siteManager,
  ROLE_NAMES.siteAuditor,
]

export const userCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'নাম দিন')
    .max(255, 'নাম একটু ছোট করুন'),
  phone_number: bdPhoneNumberSchema,
  password: passwordCreateSchema,
})

/** Admin user PATCH — only is_active + assignment replace. Single group only. */
export const userAdminUpdateSchema = z.object({
  is_active: z.boolean(),
  groups: z.array(z.string().min(1)).max(1),
  sites: z.array(z.number().int()),
})

export const profileUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'নাম দিন')
    .max(255, 'নাম একটু ছোট করুন'),
  phone_number: bdPhoneNumberSchema,
  email: optionalEmail,
})

export const toUserCreatePayload = ({ name, phone_number, password }) => ({
  name: String(name ?? '').trim(),
  phone_number: String(phone_number ?? '').trim(),
  password: String(password ?? ''),
})

export const toUserAdminUpdatePayload = ({ is_active, groups, sites }) => ({
  is_active: Boolean(is_active),
  groups: (groups ?? [])
    .map((g) => String(g ?? '').trim())
    .filter(Boolean)
    .slice(0, 1),
  sites: (sites ?? []).map((id) => Number(id)),
})

const profileTextFields = ({ name, phone_number, email }) => ({
  name: String(name ?? '').trim(),
  phone_number: String(phone_number ?? '').trim(),
  email: email?.trim() ? email.trim() : null,
})

/** PATCH /profile. File upload uses multipart; clearing photo sends JSON null. */
export const toProfileUpdatePayload = ({
  name,
  phone_number,
  email,
  photoFile,
  removePhoto,
} = {}) => {
  const fields = profileTextFields({ name, phone_number, email })
  if (photoFile instanceof File) {
    const form = new FormData()
    form.append('name', fields.name)
    form.append('phone_number', fields.phone_number)
    form.append('email', fields.email ?? '')
    form.append('photo', photoFile)
    return form
  }
  if (removePhoto) return { ...fields, photo: null }
  return fields
}

/** Normalize API groups (objects or names) → string[]. */
export const normalizeGroupNames = (groups) =>
  (Array.isArray(groups) ? groups : [])
    .map((g) => {
      if (typeof g === 'string') return g.trim()
      if (g && typeof g === 'object' && g.name != null) return String(g.name).trim()
      return ''
    })
    .filter(Boolean)

/** Prefer a single group for the form (Company Admin wins if present). */
export const toSingleGroupNames = (groups) => {
  const names = normalizeGroupNames(groups)
  if (names.includes(ROLE_NAMES.companyAdmin)) return [ROLE_NAMES.companyAdmin]
  return names.slice(0, 1)
}

/** Normalize API sites (objects or ids) → number[]. */
export const normalizeSiteIds = (sites) =>
  (Array.isArray(sites) ? sites : [])
    .map((s) => (typeof s === 'object' && s != null ? s.id : s))
    .filter((id) => id != null && id !== '')
    .map(Number)

/**
 * Assigned site ids from `allowed_sites` (user detail or profile).
 * Resolve names from the company catalog on GET /profile (`sites`), not this list.
 */
export const profileAllowedSiteIds = (resource) =>
  normalizeSiteIds(resource?.allowed_sites)

/** Assigned groups from `allowed_groups` (user detail or profile). */
export const profileAllowedGroups = (resource) => {
  const raw = resource?.allowed_groups
  return Array.isArray(raw) ? raw : []
}

/**
 * Select options for user group (single choice).
 * Company Admin is only listed when already assigned, and is not selectable.
 */
export const buildGroupSelectOptions = (currentGroups = []) => {
  const current = new Set(normalizeGroupNames(currentGroups))
  const options = []

  if (current.has(ROLE_NAMES.companyAdmin)) {
    options.push({
      name: ROLE_NAMES.companyAdmin,
      label: groupLabelBn(ROLE_NAMES.companyAdmin),
      disabled: true,
    })
  }

  for (const name of ASSIGNABLE_GROUP_NAMES) {
    options.push({
      name,
      label: groupLabelBn(name),
      disabled: false,
    })
  }

  return options
}

export const userStatusLabel = (user) => {
  if (!user) return '—'
  if (!user.is_active) return STATUS_LABEL.inactive
  return STATUS_LABEL.active
}

export const userStatusClass = (user) => {
  if (!user) return ''
  if (!user.is_active) return 'badge-ghost'
  return 'badge-success'
}
