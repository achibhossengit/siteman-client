/** Local calendar-date helpers for the site date selector. */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export const isIsoDate = (value) =>
  typeof value === 'string' && ISO_RE.test(value)

export const parseIsoDate = (iso) => {
  if (!isIsoDate(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null
  }
  return date
}

export const toIsoDate = (value = new Date()) => {
  const d = value instanceof Date ? value : parseIsoDate(value)
  if (!d || Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayIso = () => toIsoDate(new Date())

export const clampIsoToToday = (iso) => {
  const today = todayIso()
  if (!isIsoDate(iso)) return today
  return iso > today ? today : iso
}

/** Null when missing or the same as start (single-day). */
export const normalizeEndDate = (start, end) => {
  if (!isIsoDate(start) || !isIsoDate(end) || end === start) return null
  return end
}

export const DATE_PRESETS = [
  { id: 'today', label: 'আজ' },
  { id: 'this_week', label: 'এই সপ্তাহ' },
  { id: 'this_month', label: 'এই মাস' },
  { id: 'last_month', label: 'গত মাস' },
]

/** Saturday = 0 … Friday = 6 */
const weekdayIndexSat = (d) => (d.getDay() + 1) % 7

const startOfWeekSaturday = (d) => {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  next.setDate(next.getDate() - weekdayIndexSat(next))
  return next
}

const endOfWeekSaturday = (d) => {
  const start = startOfWeekSaturday(d)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}

const minDate = (a, b) => (a.getTime() <= b.getTime() ? a : b)

export const presetRange = (id, today = new Date()) => {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayStr = toIsoDate(t)

  switch (id) {
    case 'today':
      return { start: todayStr, end: null }
    case 'this_week': {
      const start = startOfWeekSaturday(t)
      const end = minDate(endOfWeekSaturday(t), t)
      return {
        start: toIsoDate(start),
        end: normalizeEndDate(toIsoDate(start), toIsoDate(end)),
      }
    }
    case 'last_week': {
      const thisStart = startOfWeekSaturday(t)
      const start = new Date(thisStart)
      start.setDate(thisStart.getDate() - 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { start: toIsoDate(start), end: toIsoDate(end) }
    }
    case 'this_month': {
      const start = new Date(t.getFullYear(), t.getMonth(), 1)
      return {
        start: toIsoDate(start),
        end: normalizeEndDate(toIsoDate(start), todayStr),
      }
    }
    case 'last_month': {
      const start = new Date(t.getFullYear(), t.getMonth() - 1, 1)
      const end = new Date(t.getFullYear(), t.getMonth(), 0)
      return { start: toIsoDate(start), end: toIsoDate(end) }
    }
    case 'this_year': {
      const start = new Date(t.getFullYear(), 0, 1)
      return {
        start: toIsoDate(start),
        end: normalizeEndDate(toIsoDate(start), todayStr),
      }
    }
    case 'last_year': {
      const y = t.getFullYear() - 1
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    default:
      return { start: todayStr, end: null }
  }
}

export const matchPresetId = (start, end, today = new Date()) => {
  const normalized = normalizeEndDate(start, end)
  for (const { id } of DATE_PRESETS) {
    const range = presetRange(id, today)
    if (range.start === start && range.end === normalized) return id
  }
  return null
}

export const weekdayIndexSaturday = (iso) => {
  const d = parseIsoDate(iso)
  if (!d) return 0
  return weekdayIndexSat(d)
}

/** 6×7 cells, week starts Saturday. */
export const monthGrid = (year, month, today = todayIso()) => {
  const first = new Date(year, month, 1)
  const saturdayOffset = weekdayIndexSat(first)
  const cursor = new Date(year, month, 1 - saturdayOffset)
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    const iso = toIsoDate(cursor)
    cells.push({
      iso,
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === month,
      disabled: iso > today,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return cells
}

export const formatDateBn = (iso) => {
  const d = parseIsoDate(iso)
  if (!d) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export const formatDateRangeBn = (start, end) => {
  const normalized = normalizeEndDate(start, end)
  if (!normalized) return formatDateBn(start)
  const from = parseIsoDate(start)
  const to = parseIsoDate(normalized)
  if (!from || !to) return formatDateBn(start)
  const sameYear = from.getFullYear() === to.getFullYear()
  const startLabel = new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(from)
  return `${startLabel} – ${formatDateBn(normalized)}`
}

/** Inclusive list of ISO dates from start through end. */
export const eachIsoDate = (start, end) => {
  const from = parseIsoDate(start)
  const to = parseIsoDate(end || start)
  if (!from || !to) return isIsoDate(start) ? [start] : []
  const first = to < from ? to : from
  const last = to < from ? from : to
  const days = []
  const cursor = new Date(first)
  while (cursor <= last) {
    days.push(toIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** Compact column header, e.g. ২৬/৮/২৬ */
export const formatDateColBn = (iso) => {
  const d = parseIsoDate(iso)
  if (!d) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).format(d)
}

export const WEEKDAY_LABELS_BN = [
  'শনি',
  'রবি',
  'সোম',
  'মঙ্গল',
  'বুধ',
  'বৃহ',
  'শুক্র',
]
