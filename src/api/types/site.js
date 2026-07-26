/**
 * Site / SiteList from /api/v1/sites
 * List: { id, name, is_active, is_closed }
 * Detail: + closed_at, company, created_by, created_at, updated_at
 */

import { z } from 'zod'

export const siteFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'সাইটের নাম দিন')
    .max(255, 'নাম একটু ছোট করুন'),
  is_active: z.boolean(),
})

export const toSitePayload = ({ name, is_active }) => ({
  name: String(name ?? '').trim(),
  is_active: Boolean(is_active),
})

export const normalizeSite = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    name: raw.name ?? '',
    isActive: Boolean(raw.is_active),
    isClosed: Boolean(raw.is_closed),
    closedAt: raw.closed_at ?? null,
    company: raw.company ?? null,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export const normalizeSiteList = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeSite).filter(Boolean)
}

/** Badge label for list/detail status. */
export const siteStatusLabel = (site) => {
  if (!site) return '—'
  if (site.isClosed) return 'বন্ধ'
  if (!site.isActive) return 'নিষ্ক্রিয়'
  return 'সক্রিয়'
}

export const siteStatusClass = (site) => {
  if (!site) return ''
  if (site.isClosed) return 'badge-error'
  if (!site.isActive) return 'badge-ghost'
  return 'badge-success'
}
