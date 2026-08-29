/**
 * SiteCashList / SiteCash from /sites/{site_pk}/cash
 * { id, date, type, amount, note, file, billing, created_at, updated_at,
 *   pending_activities: [{ id, action }] }
 *
 * Paginated GET may include list totals (`totals` or top-level
 * deposit / withdrawal / cost) for the filtered window.
 * Create / update with an image uses multipart (`file`); clearing sends JSON null.
 */

import { z } from 'zod'

export const CASH_TYPES = [
  { value: 'deposit', label: 'ক্যাশ ইন' },
  { value: 'withdrawal', label: 'ক্যাশ আউট' },
  { value: 'cost', label: 'খরচ' },
]

export const cashTypeLabel = (type) =>
  CASH_TYPES.find((t) => t.value === type)?.label ?? type ?? 'সাধারন'

const asAmount = (value) => {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Totals from a paginated cash list page.
 * Accepts `page.totals` or top-level deposit / withdrawal / cost fields.
 */
export const cashListTotalsOf = (page) => {
  if (!page || typeof page !== 'object' || Array.isArray(page)) return null
  const raw =
    page.totals && typeof page.totals === 'object' && !Array.isArray(page.totals)
      ? page.totals
      : page
  const deposit = asAmount(raw.deposit ?? raw.total_deposit)
  const withdrawal = asAmount(raw.withdrawal ?? raw.total_withdrawal)
  const cost = asAmount(raw.cost ?? raw.total_cost)
  const net = asAmount(raw.net ?? raw.total_net)
  if (deposit == null && withdrawal == null && cost == null && net == null) {
    return null
  }
  const d = deposit ?? 0
  const w = withdrawal ?? 0
  const c = cost ?? 0
  return {
    deposit: d,
    withdrawal: w,
    cost: c,
    net: net ?? d - w - c,
  }
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
  date: z
    .string()
    .min(1, 'তারিখ দিন')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'সঠিক তারিখ দিন'),
  billing: z.string().optional(),
})

export const cashFileLabel = (value) => {
  if (value == null || value === '' || value === 'None' || value === 'null') {
    return '—'
  }
  return 'ছবি'
}

/** Build API body; empty optional billing → null. File upload uses multipart. */
export const toSiteCashPayload = ({
  type,
  amount,
  date,
  note,
  billing,
  file,
  removeFile,
} = {}) => {
  const fields = {
    type,
    amount: Number(amount),
    date,
    note: String(note ?? '').trim(),
    billing: billing === '' || billing == null ? null : Number(billing),
  }

  if (file instanceof File) {
    const form = new FormData()
    form.append('type', fields.type)
    form.append('amount', String(fields.amount))
    form.append('date', fields.date)
    form.append('note', fields.note)
    form.append('billing', fields.billing == null ? '' : String(fields.billing))
    form.append('file', file)
    return form
  }

  if (removeFile) return { ...fields, file: null }
  return fields
}
