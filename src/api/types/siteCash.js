/**
 * SiteCashList / SiteCash from /sites/{site_pk}/cash
 * { id, date, type, category, amount, note, billing, created_at, updated_at }
 */

import { z } from 'zod'

export const CASH_TYPES = [
  { value: 'deposit', label: 'জমা' },
  { value: 'withdrawal', label: 'উত্তোলন' },
  { value: 'cost', label: 'খরচ' },
]

export const CASH_CATEGORIES = [
  { value: 'food', label: 'খোরাকি' },
  { value: 'equipment', label: 'সরঞ্জাম' },
]

export const cashTypeLabel = (type) =>
  CASH_TYPES.find((t) => t.value === type)?.label ?? type ?? 'সাধারন'

export const cashCategoryLabel = (category) => {
  if (category == null || category === '') return ''
  return CASH_CATEGORIES.find((c) => c.value === category)?.label ?? 'সাধারন'
}

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
  category: z.string().optional(),
  billing: z.string().optional(),
})

/** Build API body; category only for cost; empty optional → null. */
export const toSiteCashPayload = ({
  type,
  amount,
  date,
  note,
  category,
  billing,
}) => ({
  type,
  amount: Number(amount),
  ...(date ? { date } : {}),
  note: String(note ?? '').trim(),
  category: type === 'cost' && category ? category : null,
  billing: billing === '' || billing == null ? null : Number(billing),
})
