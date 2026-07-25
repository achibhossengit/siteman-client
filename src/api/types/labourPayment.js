/**
 * SiteLabourPaymentList from /sites/{site_pk}/labour-payments
 * { id, labour_name, date, type, category, amount, note, is_sealed, ... }
 *
 * category: fooding | advance (খোরাকি)
 * type: payment | return
 */

const num = (v) => {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const PAYMENT_CATEGORIES = [
  { value: 'fooding', label: 'ফুডিং' },
  { value: 'advance', label: 'খোরাকি' },
]

export const normalizeLabourPayment = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    labourName: raw.labour_name ?? '',
    date: raw.date ?? null,
    type: raw.type ?? 'payment',
    category: raw.category || null,
    amount: num(raw.amount),
    note: raw.note ?? null,
    isSealed: Boolean(raw.is_sealed),
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export const normalizeLabourPaymentList = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeLabourPayment).filter(Boolean)
}

/**
 * Aggregate payments by labour_name.
 * Returns Map<labourName, { fooding, khoraki, all }>.
 * Returns subtract from the matching category / all.
 */
export const aggregatePaymentsByLabour = (payments) => {
  const map = new Map()

  for (const p of payments) {
    const key = p.labourName || ''
    const entry = map.get(key) ?? { fooding: 0, khoraki: 0, all: 0 }
    const signed = p.type === 'return' ? -num(p.amount) : num(p.amount)

    if (p.category === 'fooding') entry.fooding += signed
    else if (p.category === 'advance') entry.khoraki += signed

    entry.all += signed
    map.set(key, entry)
  }

  return map
}

export const emptyPaymentTotals = () => ({ fooding: 0, khoraki: 0, all: 0 })

export const sumPaymentTotals = (entries) =>
  entries.reduce(
    (acc, p) => {
      acc.fooding += num(p.fooding)
      acc.khoraki += num(p.khoraki)
      acc.all += num(p.all)
      return acc
    },
    emptyPaymentTotals(),
  )
