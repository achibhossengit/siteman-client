import { z } from 'zod'
import { STATUS_LABEL } from '../../utils/format.js'
import { bdPhoneNumberSchema } from '../../utils/phone.js'
import { CompanyCatalog } from '../../utils/companyCatalog.js'

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

export const userCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'নাম দিন')
    .max(255, 'নাম একটু ছোট করুন'),
  phone_number: bdPhoneNumberSchema,
  password: passwordCreateSchema,
  groups: z.array(z.number().int()),
  sites: z.array(z.number().int()),
})

/** Admin user PATCH — is_active + assignment replace. Multiple groups allowed. */
export const userAdminUpdateSchema = z.object({
  is_active: z.boolean(),
  groups: z.array(z.number().int()),
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

export const toUserCreatePayload = ({
  name,
  phone_number,
  password,
  groups,
  sites,
}) => ({
  name: String(name ?? '').trim(),
  phone_number: String(phone_number ?? '').trim(),
  password: String(password ?? ''),
  groups: CompanyCatalog.ids(groups),
  allowed_sites: CompanyCatalog.ids(sites),
})

export const toUserAdminUpdatePayload = ({ is_active, groups, sites }) => ({
  is_active: Boolean(is_active),
  groups: CompanyCatalog.ids(groups),
  allowed_sites: CompanyCatalog.ids(sites),
})

/** Map API `allowed_sites` errors onto form field `sites`. */
export const applyUserAdminFieldErrors = (parsed, setError) => {
  if (!parsed?.fieldErrors || !setError) return
  const fieldErrors = { ...parsed.fieldErrors }
  if (fieldErrors.allowed_sites) {
    fieldErrors.sites = fieldErrors.allowed_sites
    delete fieldErrors.allowed_sites
  }
  for (const [attr, messages] of Object.entries(fieldErrors)) {
    setError(attr, { type: 'server', message: messages[0] })
  }
}

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

/** Normalize API sites (objects or ids) → number[]. */
export const normalizeSiteIds = (sites) =>
  (Array.isArray(sites) ? sites : [])
    .map((s) => (typeof s === 'object' && s != null ? s.id : s))
    .filter((id) => id != null && id !== '')
    .map(Number)

/**
 * Assigned site ids from user detail (`allowed_sites`) or profile.
 * Resolve names from the company catalog on GET /company (`sites`).
 */
export const profileAllowedSiteIds = (resource) =>
  CompanyCatalog.assignedSiteIds(resource)

/** Assigned group ids from user detail (`allowed_groups`). */
export const profileAllowedGroups = (resource) =>
  CompanyCatalog.assignedGroupIds(resource)

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
