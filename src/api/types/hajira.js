/**
 * Site daily-record helpers for হাজিরা.
 * Site list GET returns `{ labour, record }` roster rows.
 *
 * Record fields: present, wage, extra_earn, fooding_pay, advance_pay,
 * return_amount, note, billing, pending_activities
 * UI row keeps short names (salary/extra/payment) for existing page code.
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
    .number({ message: 'বাড়তি কাজ দিন' })
    .int('পূর্ণ সংখ্যা দিন')
    .min(0, 'বাড়তি কাজ ০ বা তার বেশি হতে হবে'),
  note: z.string().trim().max(255, 'নোট একটু ছোট করুন').optional(),
  billing: z.string().optional(),
})

const blankAmount = (value) => {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n : ''
}

const isRosterEntry = (item) =>
  item != null &&
  typeof item === 'object' &&
  item.labour != null &&
  typeof item.labour === 'object' &&
  'record' in item

/** Normalize flat legacy records or nested `{ labour, record }` entries. */
const asRosterEntries = (items = []) => {
  if (!Array.isArray(items) || !items.length) return []
  if (isRosterEntry(items[0])) return items

  return items.map((record) => {
    const labourId =
      record?.labour_id ??
      record?.labourId ??
      (typeof record?.labour === 'object'
        ? record.labour?.id
        : record?.labour) ??
      null
    return {
      labour: {
        id: labourId,
        name: record?.labour_name ?? record?.labourName ?? null,
        photo: record?.labour_photo ?? record?.labourPhoto ?? null,
        current_site:
          record?.labour_current_site ?? record?.labourCurrentSite ?? null,
        default_attendance: 0,
        default_salary: 0,
        default_fooding: 0,
        is_active: true,
      },
      record,
    }
  })
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
    extra_earn:
      row.extra === '' || row.extra == null ? null : Number(row.extra) || null,
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

/** One UI row from a SiteDailyRecordList entry `{ labour, record }`. */
export const buildHajiraRowFromEntry = (entry) => {
  const labour = entry?.labour ?? {}
  const record = entry?.record ?? null
  const labourId = Number(labour.id)
  const sealed = Boolean(record?.is_sealed)
  const labourCurrentSite =
    labour.current_site == null || labour.current_site === ''
      ? null
      : Number(labour.current_site)

  return {
    labourId,
    labourName: labour.name ?? `#${labourId}`,
    labourPhoto: labour.photo ?? null,
    labourCurrentSite,
    labourIsActive: labour.is_active !== false,
    lastSessionDate: labour.last_session_date ?? null,
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
      record?.wage == null || record?.wage === '' ? '' : Number(record.wage),
    extra:
      record == null
        ? ''
        : record.extra_earn == null || record.extra_earn === ''
          ? ''
          : Number(record.extra_earn) || 0,
    extraNote: record?.note ?? '',
    billing:
      record?.billing != null && record?.billing !== ''
        ? String(record.billing)
        : '',
    billingName: record?.billing_name ?? null,
    siteId: record?.site ?? null,
    payment: blankAmount(record?.fooding_pay),
    paymentNote: '',
    advance: blankAmount(record?.advance_pay),
    advanceNote: '',
    return: blankAmount(record?.return_amount),
    returnNote: '',
    pending_activities: Array.isArray(record?.pending_activities)
      ? record.pending_activities
      : [],
  }
}

/**
 * Build hajira table rows from site daily-records roster.
 * Filters:
 * - labour: labour.current_site matches siteId
 * - record: entry has a day's record
 */
export const buildHajiraRowsFromRoster = (
  items = [],
  { siteId, includeLabour = true, includeRecord = true } = {},
) => {
  if (!includeLabour && !includeRecord) return []

  const site =
    siteId != null && siteId !== '' ? Number(siteId) : null
  const entries = asRosterEntries(items).filter((entry) => {
    const labourId = entry?.labour?.id
    if (labourId == null || labourId === '') return false
    const onSite =
      site == null || Number(entry.labour.current_site) === site
    const hasRecord = entry.record != null
    if (includeLabour && includeRecord) return onSite || hasRecord
    if (includeLabour) return onSite
    return hasRecord
  })

  return entries
    .map(buildHajiraRowFromEntry)
    .sort((a, b) =>
      String(a.labourName).localeCompare(String(b.labourName), 'bn'),
    )
}

/**
 * @deprecated Prefer buildHajiraRowsFromRoster.
 * One editable row per labour; records matched by labour id.
 */
export const buildHajiraEditRows = (labours, records = []) => {
  const byLabour = new Map()
  for (const record of asRosterEntries(records)) {
    const id = Number(record.labour?.id)
    if (!Number.isFinite(id)) continue
    if (!byLabour.has(id)) byLabour.set(id, record.record)
  }

  const entries = labours.map((labour) => ({
    labour,
    record: byLabour.get(Number(labour.id)) ?? null,
  }))
  return buildHajiraRowsFromRoster(entries, {
    includeLabour: true,
    includeRecord: true,
  })
}

/**
 * @deprecated Prefer buildHajiraRowsFromRoster.
 * View rows from records only.
 */
export const buildHajiraViewRows = (records = []) => {
  const entries = asRosterEntries(records).filter((e) => e.record != null)
  return buildHajiraRowsFromRoster(entries, {
    includeLabour: false,
    includeRecord: true,
  })
}

/** @deprecated Prefer buildHajiraRowsFromRoster. */
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
