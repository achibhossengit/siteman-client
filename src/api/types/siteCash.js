/**
 * SiteCashList / SiteCash from /sites/{site_pk}/cash
 * { id, date, type, amount, note, billing, created_at, updated_at,
 *   pending_activities: [{ id, action }] }
 */

import { z } from 'zod'

export const CASH_TYPES = [
  { value: 'deposit', label: 'ক্যাশ ইন' },
  { value: 'withdrawal', label: 'ক্যাশ আউট' },
  { value: 'cost', label: 'খরচ' },
]

export const cashTypeLabel = (type) =>
  CASH_TYPES.find((t) => t.value === type)?.label ?? type ?? 'সাধারন'

/** Shared create / update form schema. */
export const cashFormSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, 'নোট দিতে হবে')
    .max(255, 'নোট একটু ছোট করুন'),
  type: z.enum(['deposit', 'withdrawal', 'cost'], {
    message: 'ধরন নির্বাচন করুন',
  }),
  amount: z.coerce
    .number({ message: 'পরিমাণ দিন' })
    .int('পূর্ণ সংখ্যা দিন')
    .gt(0, 'পরিমাণ শূন্যের বেশি হতে হবে'),
  billing: z.string().optional(),
})

/** Build API body; empty optional billing → null. */
export const toSiteCashPayload = ({ type, amount, date, note, billing }) => ({
  type,
  amount: Number(amount),
  ...(date ? { date } : {}),
  note: String(note ?? '').trim(),
  billing: billing === '' || billing == null ? null : Number(billing),
})
