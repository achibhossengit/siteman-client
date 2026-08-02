/**
 * Site / SiteList from /api/v1/sites
 * List: { id, name, is_active, is_closed }
 * Detail: + closed_at, company, created_at, updated_at
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

/** Badge label for list/detail status. */
export const siteStatusLabel = (site) => {
  if (!site) return '—'
  if (site.is_closed) return 'বন্ধ'
  if (!site.is_active) return 'নিষ্ক্রিয়'
  return 'সক্রিয়'
}

export const siteStatusClass = (site) => {
  if (!site) return ''
  if (site.is_closed) return 'badge-error'
  if (!site.is_active) return 'badge-ghost'
  return 'badge-success'
}
