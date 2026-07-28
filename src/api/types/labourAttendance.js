/**
 * SiteLabourAttendanceList from /sites/{site_pk}/labour-attendances
 * { id, labour_name, date, present, salary, extra, note, billing, is_sealed, ... }
 */

const num = (v) => {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const nullableNum = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const normalizeLabourAttendance = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: raw.id,
    labourName: raw.labour_name ?? '',
    site: raw.site ?? null,
    date: raw.date ?? null,
    present: nullableNum(raw.present) ?? 0,
    salary: nullableNum(raw.salary),
    extra: nullableNum(raw.extra) ?? 0,
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

/** Sum present / extra across attendance rows. */
export const sumAttendances = (rows) =>
  rows.reduce(
    (acc, row) => {
      acc.present += num(row.present)
      acc.extra += num(row.extra)
      return acc
    },
    { present: 0, extra: 0 },
  )
