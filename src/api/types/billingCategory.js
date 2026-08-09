/**
 * BillingCategory nested under /api/v1/sites/{site_pk}/billing-categories
 * Writable: name, display_order, is_active, is_done (done => deactivates).
 */

import { z } from 'zod'
import { STATUS_LABEL } from '../../utils/format.js'

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
}) => {
  const done = Boolean(is_done)
  return {
    name: String(name ?? '').trim(),
    display_order: Number(display_order) || 0,
    is_done: done,
    // Done categories cannot be active.
    is_active: done ? false : Boolean(is_active),
  }
}

export const billingStatusLabel = (row) => {
  if (!row) return '—'
  if (row.is_done) return STATUS_LABEL.done
  if (!row.is_active) return STATUS_LABEL.inactive
  return STATUS_LABEL.active
}

export const billingStatusClass = (row) => {
  if (!row) return ''
  if (row.is_done) return 'badge-info'
  if (!row.is_active) return 'badge-ghost'
  return 'badge-success'
}
