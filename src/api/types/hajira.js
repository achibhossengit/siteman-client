/**
 * Site daily-record helpers for হাজিরা.
 * Site list GET returns `{ labour, records, totals }` roster rows.
 * Single-date screens pick the matching item from `records`.
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
  date: z
    .string()
    .min(1, 'তারিখ দিন')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'সঠিক তারিখ দিন')
    .optional(),
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
  ('records' in item || 'record' in item)

/** Pick the day's nested record. Single-date windows have 0–1 items. */
const pickRecordForDate = (records, date) => {
  if (!Array.isArray(records) || !records.length) return null
  if (date) {
    return records.find((r) => r?.date === date) ?? null
  }
  return records.length === 1 ? records[0] : null
}

const recordsOf = (item) => {
  if (Array.isArray(item?.records)) return item.records
  if (item?.record != null) return [item.record]
  return []
}

/** Normalize `{ labour, records, totals }` (or legacy `{ labour, record }`). */
const asRosterEntries = (items = [], date) => {
  if (!Array.isArray(items) || !items.length) return []
  if (isRosterEntry(items[0])) {
    return items.map((item) => {
      const records = recordsOf(item)
      return {
        labour: item.labour,
        records,
        totals: item.totals ?? null,
        record: pickRecordForDate(records, date),
      }
    })
  }

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
      records: record ? [record] : [],
      totals: null,
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
  const recordDate = date || row.date
  return {
    labour: row.labourId,
    ...(recordDate ? { date: recordDate } : {}),
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

/** Patch body without labour. */
export const toDailyRecordPatchPayload = (row) => {
  const { labour: _labour, ...rest } = toDailyRecordPayload(row, row.date)
  return rest
}

/** One UI row from a SiteDailyRecordList entry `{ labour, records, totals }`. */
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
    date: record?.date ?? null,
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
 * - record: entry has a nested record for `date` (single-date screens)
 */
export const buildHajiraRowsFromRoster = (
  items = [],
  { siteId, includeLabour = true, includeRecord = true, date } = {},
) => {
  if (!includeLabour && !includeRecord) return []

  const site =
    siteId != null && siteId !== '' ? Number(siteId) : null
  const entries = asRosterEntries(items, date).filter((entry) => {
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
    .map((entry) => {
      const row = buildHajiraRowFromEntry(entry)
      return { ...row, date: row.date || date || null }
    })
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

const asNum = (value) => {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const isNonZeroTotals = (t) =>
  Boolean(t && (t.present || t.extra || t.outflow || t.returned))

/** Present / extra on the left, outflow / return on the right. */
export const dailyRecordDayValues = (record) => {
  if (!record) {
    return { present: 0, extra: 0, outflow: 0, returned: 0, empty: true }
  }
  const present = asNum(record.present)
  const extra = asNum(record.extra_earn ?? record.extra)
  const outflow =
    asNum(record.fooding_pay ?? record.payment) +
    asNum(record.advance_pay ?? record.advance)
  const returned = asNum(record.return_amount ?? record.return)
  return {
    present,
    extra,
    outflow,
    returned,
    empty: present === 0 && extra === 0 && outflow === 0 && returned === 0,
  }
}

export const totalsValuesOf = (totals) => ({
  present: asNum(totals?.present),
  extra: asNum(totals?.extra_earn),
  outflow: asNum(totals?.fooding_pay) + asNum(totals?.advance_pay),
  returned: asNum(totals?.return_amount),
})

const sumDayValues = (days) =>
  (days ?? []).reduce(
    (acc, day) => {
      acc.present += asNum(day.present)
      acc.extra += asNum(day.extra)
      acc.outflow += asNum(day.outflow)
      acc.returned += asNum(day.returned)
      return acc
    },
    { present: 0, extra: 0, outflow: 0, returned: 0 },
  )

/**
 * Range hajira rows: one labour, a cell per date, plus window totals.
 * Day columns should be omitted by the UI when the window is > 1 month
 * (API then returns totals without nested records).
 */
export const buildHajiraRangeRows = (
  items = [],
  { siteId, includeLabour = true, includeRecord = true, dates = [] } = {},
) => {
  if (!includeLabour && !includeRecord) return []

  const site = siteId != null && siteId !== '' ? Number(siteId) : null
  const entries = asRosterEntries(items).filter((entry) => {
    const labourId = entry?.labour?.id
    if (labourId == null || labourId === '') return false
    const onSite =
      site == null || Number(entry.labour.current_site) === site
    const hasRecords = (entry.records ?? []).length > 0
    const hasTotals = isNonZeroTotals(totalsValuesOf(entry.totals))
    const hasActivity = hasRecords || hasTotals
    if (includeLabour && includeRecord) return onSite || hasActivity
    if (includeLabour) return onSite
    return hasActivity
  })

  return entries
    .map((entry) => {
      const labour = entry.labour ?? {}
      const labourId = Number(labour.id)
      const byDate = new Map()
      for (const rec of entry.records ?? []) {
        if (rec?.date) byDate.set(rec.date, rec)
      }
      const days = (dates ?? []).map((iso) => {
        const record = byDate.get(iso) ?? null
        return { date: iso, record, ...dailyRecordDayValues(record) }
      })
      const fromApi = totalsValuesOf(entry.totals)
      const totals = isNonZeroTotals(fromApi) ? fromApi : sumDayValues(days)
      const labourCurrentSite =
        labour.current_site == null || labour.current_site === ''
          ? null
          : Number(labour.current_site)
      return {
        labour,
        labourId,
        labourName: labour.name ?? `#${labourId}`,
        labourPhoto: labour.photo ?? null,
        labourCurrentSite,
        labourIsActive: labour.is_active !== false,
        days,
        totals,
      }
    })
    .sort((a, b) =>
      String(a.labourName).localeCompare(String(b.labourName), 'bn'),
    )
}

export const sumHajiraRangeFooter = (rows, dates = []) => {
  const byDate = (dates ?? []).map((iso) => ({
    date: iso,
    present: 0,
    extra: 0,
    outflow: 0,
    returned: 0,
  }))
  const totals = { present: 0, extra: 0, outflow: 0, returned: 0 }
  for (const row of rows ?? []) {
    totals.present += asNum(row.totals?.present)
    totals.extra += asNum(row.totals?.extra)
    totals.outflow += asNum(row.totals?.outflow)
    totals.returned += asNum(row.totals?.returned)
    for (let i = 0; i < byDate.length; i += 1) {
      const day = row.days?.[i]
      if (!day) continue
      byDate[i].present += asNum(day.present)
      byDate[i].extra += asNum(day.extra)
      byDate[i].outflow += asNum(day.outflow)
      byDate[i].returned += asNum(day.returned)
    }
  }
  return { byDate, totals }
}
