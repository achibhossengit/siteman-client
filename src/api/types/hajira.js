/**
 * Site labour attendance / payment list items for হাজিরা.
 * List payloads may use `labour` or `labour_id`, plus `labour_name`.
 */

const num = (v, fallback = 0) => {
  if (v == null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Prefer `labour_id`, then `labour` (id or nested object). */
const resolveLabourId = (raw) => {
  const candidate = raw?.labour_id ?? raw?.labourId ?? raw?.labour ?? null
  if (candidate == null || candidate === '') return null
  if (typeof candidate === 'object') {
    const id = candidate.id ?? candidate.pk ?? null
    return id == null ? null : num(id, null)
  }
  return num(candidate, null)
}

const resolveLabourName = (raw, labourId) => {
  if (raw?.labour_name) return raw.labour_name
  if (raw?.labourName) return raw.labourName
  if (raw?.labour && typeof raw.labour === 'object' && raw.labour.name) {
    return raw.labour.name
  }
  return labourId != null ? `#${labourId}` : '—'
}

/** Stable map key: labour id, else name, else unique fallback. */
const labourKey = (labourId, labourName, fallback) => {
  if (labourId != null) return `id:${labourId}`
  if (labourName && labourName !== '—') return `name:${labourName}`
  return fallback
}

export const normalizeLabourAttendance = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  const labourId = resolveLabourId(raw)
  return {
    id: raw.id,
    labourId,
    labourName: resolveLabourName(raw, labourId),
    date: raw.date ?? null,
    present: raw.present == null ? null : num(raw.present, null),
    salary: raw.salary == null ? null : num(raw.salary),
    extra: raw.extra == null ? null : num(raw.extra),
    note: raw.note ?? null,
    billing: raw.billing ?? null,
    isSealed: Boolean(raw.is_sealed),
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export const normalizeLabourAttendanceList = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeLabourAttendance).filter(Boolean)
}

export const normalizeLabourPayment = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  const labourId = resolveLabourId(raw)
  return {
    id: raw.id,
    labourId,
    labourName: resolveLabourName(raw, labourId),
    date: raw.date ?? null,
    type: raw.type ?? 'payment',
    category: raw.category ?? null,
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
 * One table row per labour: sum all attendances + payments for that labour.
 * Payment `return` reduces the payment total.
 */
export const mergeHajiraRows = (attendances, payments) => {
  const byLabour = new Map()

  const ensureRow = (labourId, labourName, fallbackKey) => {
    const key = labourKey(labourId, labourName, fallbackKey)
    let row = byLabour.get(key)
    if (!row) {
      row = {
        key,
        labourId,
        labourName: labourName || (labourId != null ? `#${labourId}` : '—'),
        present: 0,
        extra: 0,
        billing: null,
        payment: 0,
      }
      byLabour.set(key, row)
      return row
    }
    if (
      labourName &&
      labourName !== '—' &&
      (!row.labourName || row.labourName.startsWith('#'))
    ) {
      row.labourName = labourName
    }
    if (row.labourId == null && labourId != null) {
      row.labourId = labourId
    }
    return row
  }

  for (const a of attendances) {
    const row = ensureRow(a.labourId, a.labourName, `attendance-${a.id}`)
    row.present += Number(a.present) || 0
    row.extra += Number(a.extra) || 0
    if (row.billing == null && a.billing != null) {
      row.billing = a.billing
    }
  }

  for (const p of payments) {
    const row = ensureRow(p.labourId, p.labourName, `payment-${p.id}`)
    const signed =
      p.type === 'return' ? -Math.abs(p.amount) : Math.abs(p.amount)
    row.payment += signed
  }

  return Array.from(byLabour.values())
}

export const summarizeHajiraRows = (rows) =>
  rows.reduce(
    (acc, row) => {
      acc.present += Number(row.present) || 0
      acc.extra += Number(row.extra) || 0
      acc.payment += Number(row.payment) || 0
      return acc
    },
    { present: 0, extra: 0, payment: 0 },
  )
