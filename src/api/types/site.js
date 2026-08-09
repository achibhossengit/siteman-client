/**
 * Site / SiteList from /api/v1/sites
 * List: { id, name, is_active, is_closed }
 * Detail: + closed_at, company, created_at, updated_at
 */

import { z } from 'zod'
import { STATUS_LABEL } from '../../utils/format.js'

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

/** Badge/list label for site status. */
export const siteStatusLabel = (site) => {
  if (!site) return '—'
  if (site.is_closed) return STATUS_LABEL.closed
  if (!site.is_active) return STATUS_LABEL.inactive
  return STATUS_LABEL.active
}

export const siteStatusClass = (site) => {
  if (!site) return ''
  if (site.is_closed) return 'badge-error'
  if (!site.is_active) return 'badge-ghost'
  return 'badge-success'
}
