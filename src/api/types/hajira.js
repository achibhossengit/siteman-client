/**
 * Site labour attendance / payment helpers for হাজিরা.
 * Uses backend snake_case fields as returned by the API.
 */

import { z } from 'zod'

export const PRESENT_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3]

export const attendanceFormSchema = z.object({
  present: z.coerce.number({ message: 'হাজিরা নির্বাচন করুন' }),
  salary: z.coerce
    .number({ message: 'বেতন দিন' })
    .int('পূর্ণ সংখ্যা দিন')
    .min(0, 'বেতন ০ বা তার বেশি হতে হবে'),
  extra: z.coerce
    .number({ message: 'বাড়তি দিন' })
    .int('পূর্ণ সংখ্যা দিন')
    .min(0, 'বাড়তি ০ বা তার বেশি হতে হবে'),
  note: z.string().trim().max(255, 'নোট একটু ছোট করুন').optional(),
  billing: z.string().optional(),
})

export const toAttendancePayload = ({
  present,
  salary,
  extra,
  note,
  billing,
  date,
}) => ({
  present: Number(present),
  salary: Number(salary),
  extra: Number(extra),
  note: note?.trim() ? note.trim() : null,
  billing: billing === '' || billing == null ? null : Number(billing),
  ...(date ? { date } : {}),
})

const labourIdOf = (row) => {
  const candidate = row?.labour ?? row?.labour_id ?? null
  if (candidate == null || candidate === '') return null
  if (typeof candidate === 'object') return candidate.id ?? candidate.pk ?? null
  return candidate
}

const labourNameOf = (row, labourId) => {
  if (row?.labour_name) return row.labour_name
  if (row?.labour && typeof row.labour === 'object' && row.labour.name) {
    return row.labour.name
  }
  return labourId != null ? `#${labourId}` : '—'
}

const labourKey = (labourId, labourName, fallback) => {
  if (labourId != null) return `id:${labourId}`
  if (labourName && labourName !== '—') return `name:${labourName}`
  return fallback
}

/**
 * One table row per labour: sum all attendances + payments for that labour.
 * Payment `return` reduces the payment total.
 * Output rows keep snake_case labour fields for the UI.
 */
export const mergeHajiraRows = (attendances, payments) => {
  const byLabour = new Map()

  const ensureRow = (labourId, labourName, fallbackKey) => {
    const key = labourKey(labourId, labourName, fallbackKey)
    let row = byLabour.get(key)
    if (!row) {
      row = {
        key,
        labour: labourId,
        labour_name: labourName || (labourId != null ? `#${labourId}` : '—'),
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
      (!row.labour_name || String(row.labour_name).startsWith('#'))
    ) {
      row.labour_name = labourName
    }
    if (row.labour == null && labourId != null) {
      row.labour = labourId
    }
    return row
  }

  for (const a of attendances) {
    const labourId = labourIdOf(a)
    const labourName = labourNameOf(a, labourId)
    const row = ensureRow(labourId, labourName, `attendance-${a.id}`)
    row.present += Number(a.present) || 0
    row.extra += Number(a.extra) || 0
    if (row.billing == null && a.billing != null) {
      row.billing = a.billing
    }
  }

  for (const p of payments) {
    const labourId = labourIdOf(p)
    const labourName = labourNameOf(p, labourId)
    const row = ensureRow(labourId, labourName, `payment-${p.id}`)
    const signed =
      p.type === 'return' ? -Math.abs(Number(p.amount) || 0) : Math.abs(Number(p.amount) || 0)
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

const pickPayment = (payments, labourId, matcher) => {
  for (const p of payments) {
    const id = labourIdOf(p)
    if (id == null || Number(id) !== Number(labourId)) continue
    if (matcher(p)) return p
  }
  return null
}

const blankAmount = (value) => {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n : ''
}

/**
 * One editable row per active labour. Attendance/payment rows whose labour
 * is not in `labours` are ignored.
 */
export const buildHajiraEditRows = (labours, attendances, payments) => {
  const labourIds = new Set(labours.map((l) => Number(l.id)))

  const attendanceByLabour = new Map()
  for (const a of attendances) {
    const labourId = labourIdOf(a)
    if (labourId == null || !labourIds.has(Number(labourId))) continue
    if (!attendanceByLabour.has(Number(labourId))) {
      attendanceByLabour.set(Number(labourId), a)
    }
  }

  return labours.map((labour) => {
    const labourId = Number(labour.id)
    const attendance = attendanceByLabour.get(labourId) ?? null
    const payment = pickPayment(
      payments,
      labourId,
      (p) => p.type === 'payment',
    )
    const ret = pickPayment(
      payments,
      labourId,
      (p) => p.type === 'return',
    )

    return {
      labourId,
      labourName: labour.name ?? `#${labourId}`,
      defaultAttendance: Number(labour.default_attendance) || 0,
      defaultSalary: Number(labour.default_salary) || 0,
      defaultFooding: Number(labour.default_fooding) || 0,
      attendanceId: attendance?.id ?? null,
      attendanceSealed: Boolean(attendance?.is_sealed),
      attendanceCreatedAt: attendance?.created_at ?? null,
      attendanceUpdatedAt: attendance?.updated_at ?? null,
      present:
        attendance?.present == null || attendance?.present === ''
          ? ''
          : Number(attendance.present),
      salary:
        attendance?.salary == null || attendance?.salary === ''
          ? ''
          : Number(attendance.salary),
      extra: Number(attendance?.extra) || 0,
      extraNote: attendance?.note ?? '',
      billing:
        attendance?.billing != null && attendance?.billing !== ''
          ? String(attendance.billing)
          : '',
      paymentId: payment?.id ?? null,
      paymentSealed: Boolean(payment?.is_sealed),
      payment: blankAmount(payment?.amount),
      paymentNote: payment?.note ?? '',
      paymentCreatedAt: payment?.created_at ?? null,
      paymentUpdatedAt: payment?.updated_at ?? null,
      returnId: ret?.id ?? null,
      returnSealed: Boolean(ret?.is_sealed),
      return: blankAmount(ret?.amount),
      returnNote: ret?.note ?? '',
      returnCreatedAt: ret?.created_at ?? null,
      returnUpdatedAt: ret?.updated_at ?? null,
    }
  })
}

/**
 * View rows from attendance/payment records only — one row per labour that
 * appears in the records, regardless of labour.current_site.
 */
export const buildHajiraViewRows = (attendances, payments) => {
  const labourMap = new Map()

  const ensureLabour = (row) => {
    const labourId = labourIdOf(row)
    if (labourId == null) return
    const id = Number(labourId)
    const name = labourNameOf(row, labourId)
    const existing = labourMap.get(id)
    if (!existing) {
      labourMap.set(id, {
        id,
        name,
        default_attendance: 0,
        default_salary: 0,
        default_fooding: 0,
      })
      return
    }
    if (
      name &&
      name !== '—' &&
      (!existing.name || String(existing.name).startsWith('#'))
    ) {
      existing.name = name
    }
  }

  for (const a of attendances) ensureLabour(a)
  for (const p of payments) ensureLabour(p)

  const labours = [...labourMap.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'bn'),
  )
  return buildHajiraEditRows(labours, attendances, payments)
}
