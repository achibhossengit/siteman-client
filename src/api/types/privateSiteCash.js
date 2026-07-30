/**
 * PrivateSiteCashList / PrivateSiteCash from /sites/{site_pk}/private-cash
 * { id, date, type, amount, note, billing, created_at, updated_at }
 */

import { z } from 'zod'

export const PRIVATE_CASH_TYPES = [
  { value: 'bill', label: 'বিল' },
  { value: 'cost', label: 'খরচ' },
]

export const privateCashTypeLabel = (type) =>
  PRIVATE_CASH_TYPES.find((t) => t.value === type)?.label ?? type ?? '—'

/** Shared create / update form schema. */
export const privateCashFormSchema = z.object({
  note: z
    .string()
    .trim()
    .max(255, 'নোট একটু ছোট করুন')
    .optional()
    .or(z.literal('')),
  type: z.enum(['bill', 'cost'], {
    message: 'ধরন নির্বাচন করুন',
  }),
  amount: z.coerce
    .number({ message: 'পরিমাণ দিন' })
    .int('পূর্ণ সংখ্যা দিন')
    .gt(0, 'পরিমাণ শূন্যের বেশি হতে হবে'),
  date: z.string().min(1, 'তারিখ দিন'),
  billing: z.string().optional(),
})

/** Build API body; empty optional → null. */
export const toPrivateSiteCashPayload = ({
  type,
  amount,
  date,
  note,
  billing,
}) => ({
  type,
  amount: Number(amount),
  date,
  note: String(note ?? '').trim() || null,
  billing: billing === '' || billing == null ? null : Number(billing),
})
