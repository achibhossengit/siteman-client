/**
 * Site daily-record helpers for হাজিরা.
 * DailyRecord merges former attendance + labour-payment fields.
 *
 * API fields: present, wage, extra_earn, fooding_pay, advance_pay, return_amount, note, billing
 * UI row keeps some short names (salary/extra/payment) for existing page code.
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

const labourIdOf = (row) => {
  const candidate =
    row?.labour ?? row?.labour_id ?? row?.labourId ?? null
  if (candidate == null || candidate === '') return null
  if (typeof candidate === 'object') return candidate.id ?? candidate.pk ?? null
  return candidate
}

const labourNameOf = (row, labourId) => {
  if (row?.labour_name) return row.labour_name
  if (row?.labourName) return row.labourName
  if (row?.labour && typeof row.labour === 'object' && row.labour.name) {
    return row.labour.name
  }
  return labourId != null ? `#${labourId}` : '—'
}

const blankAmount = (value) => {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n : ''
}

const numOrZero = (value) => {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Build API create/patch body from an edit row. */
export const toDailyRecordPayload = (row, date) => {
  const note =
    row.extraNote?.trim() ||
    row.paymentNote?.trim() ||
    row.advanceNote?.trim() ||
    row.returnNote?.trim() ||
    ''
  return {
    labour: row.labourId,
    ...(date ? { date } : {}),
    present:
      row.present === '' || row.present == null ? null : Number(row.present),
    wage: row.salary === '' || row.salary == null ? null : Number(row.salary),
    extra_earn: numOrZero(row.extra) || null,
    fooding_pay:
      row.payment === '' || row.payment == null ? null : Number(row.payment),
    advance_pay:
      row.advance === '' || row.advance == null ? null : Number(row.advance),
    return_amount:
      row.return === '' || row.return == null ? null : Number(row.return),
    note: note ? note : null,
    billing:
      row.billing === '' || row.billing == null ? null : Number(row.billing),
  }
}

/** Patch body without labour/date. */
export const toDailyRecordPatchPayload = (row) => {
  const { labour: _labour, date: _date, ...rest } = toDailyRecordPayload(row)
  return rest
}

/**
 * One editable row per active labour. Records whose labour is not in
 * `labours` are ignored.
 */
export const buildHajiraEditRows = (labours, records = []) => {
  const labourIds = new Set(labours.map((l) => Number(l.id)))

  const recordByLabour = new Map()
  for (const record of records) {
    const labourId = labourIdOf(record)
    if (labourId == null || !labourIds.has(Number(labourId))) continue
    if (!recordByLabour.has(Number(labourId))) {
      recordByLabour.set(Number(labourId), record)
    }
  }

  return labours.map((labour) => {
    const labourId = Number(labour.id)
    const record = recordByLabour.get(labourId) ?? null
    const sealed = Boolean(record?.is_sealed)

    return {
      labourId,
      labourName: labour.name ?? `#${labourId}`,
      defaultAttendance: Number(labour.default_attendance) || 0,
      defaultSalary: Number(labour.default_salary) || 0,
      defaultFooding: Number(labour.default_fooding) || 0,
      recordId: record?.id ?? null,
      recordSealed: sealed,
      // Legacy aliases used by existing modal/lock helpers
      attendanceId: record?.id ?? null,
      attendanceSealed: sealed,
      paymentId: record?.id ?? null,
      paymentSealed: sealed,
      advanceId: record?.id ?? null,
      advanceSealed: sealed,
      returnId: record?.id ?? null,
      returnSealed: sealed,
      recordCreatedAt: record?.created_at ?? null,
      recordUpdatedAt: record?.updated_at ?? null,
      attendanceCreatedAt: record?.created_at ?? null,
      attendanceUpdatedAt: record?.updated_at ?? null,
      paymentCreatedAt: record?.created_at ?? null,
      paymentUpdatedAt: record?.updated_at ?? null,
      advanceCreatedAt: record?.created_at ?? null,
      advanceUpdatedAt: record?.updated_at ?? null,
      returnCreatedAt: record?.created_at ?? null,
      returnUpdatedAt: record?.updated_at ?? null,
      present:
        record?.present == null || record?.present === ''
          ? ''
          : Number(record.present),
      salary:
        record?.wage == null || record?.wage === ''
          ? ''
          : Number(record.wage),
      extra: Number(record?.extra_earn) || 0,
      extraNote: record?.note ?? '',
      billing:
        record?.billing != null && record?.billing !== ''
          ? String(record.billing)
          : '',
      billingName: record?.billing_name ?? null,
      siteId: record?.site ?? null,
      siteName: record?.site_name ?? null,
      payment: blankAmount(record?.fooding_pay),
      paymentNote: '',
      advance: blankAmount(record?.advance_pay),
      advanceNote: '',
      return: blankAmount(record?.return_amount),
      returnNote: '',
    }
  })
}

/**
 * View rows from daily records only — one row per labour that appears
 * in the records, regardless of labour.current_site.
 */
export const buildHajiraViewRows = (records = []) => {
  const labourMap = new Map()

  for (const record of records) {
    const labourId = labourIdOf(record)
    if (labourId == null) continue
    const id = Number(labourId)
    const name = labourNameOf(record, labourId)
    const existing = labourMap.get(id)
    if (!existing) {
      labourMap.set(id, {
        id,
        name,
        default_attendance: 0,
        default_salary: 0,
        default_fooding: 0,
      })
      continue
    }
    if (
      name &&
      name !== '—' &&
      (!existing.name || String(existing.name).startsWith('#'))
    ) {
      existing.name = name
    }
  }

  const labours = [...labourMap.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'bn'),
  )
  return buildHajiraEditRows(labours, records)
}

/** @deprecated Prefer buildHajiraViewRows(records). Kept for call-site migration. */
export const mergeHajiraRows = (records) => {
  const rows = buildHajiraViewRows(records)
  return rows.map((row) => ({
    key: `id:${row.labourId}`,
    labour: row.labourId,
    labour_name: row.labourName,
    present: Number(row.present) || 0,
    extra: Number(row.extra) || 0,
    billing: row.billing || null,
    payment:
      (Number(row.payment) || 0) +
      (Number(row.advance) || 0) -
      (Number(row.return) || 0),
  }))
}

export const summarizeHajiraRows = (rows) =>
  rows.reduce(
    (acc, row) => {
      acc.present += Number(row.present) || 0
      acc.extra += Number(row.extra) || 0
      acc.payment +=
        (Number(row.payment) || 0) +
        (Number(row.advance) || 0) -
        (Number(row.return) || 0)
      return acc
    },
    { present: 0, extra: 0, payment: 0 },
  )
