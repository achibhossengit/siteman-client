/**
 * BillingCategory nested under /api/v1/sites/{site_pk}/billing-categories
 * Writable: name, display_order, is_active, is_done (done => deactivates).
 */

import { z } from 'zod'

export const billingCategoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'বিলিং ক্যাটাগরির নাম দিন')
    .max(255, 'নাম একটু ছোট করুন'),
  display_order: z.coerce.number().int('ক্রম সংখ্যায় দিন'),
  is_active: z.boolean(),
  is_done: z.boolean(),
})

export const toBillingCategoryPayload = ({
  name,
  display_order,
  is_active,
  is_done,
}) => ({
  name: String(name ?? '').trim(),
  display_order: Number(display_order) || 0,
  is_active: Boolean(is_active),
  is_done: Boolean(is_done),
})

export const billingStatusLabel = (row) => {
  if (!row) return '—'
  if (row.is_done) return 'সম্পন্ন'
  if (!row.is_active) return 'নিষ্ক্রিয়'
  return 'সক্রিয়'
}

export const billingStatusClass = (row) => {
  if (!row) return ''
  if (row.is_done) return 'badge-info'
  if (!row.is_active) return 'badge-ghost'
  return 'badge-success'
}
