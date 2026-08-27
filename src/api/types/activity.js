/**
 * Activity-log helpers for হাজিরা / ক্যাশ view-mode coloring.
 * OpenAPI: ActivityLog.entity_id, action in {created,updated,deleted}.
 */

export const ACTIVITY_TONES = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
}

export const activityToneClass = (tone) => {
  // Apply on <tr> via child tds — row background alone often does not paint.
  if (tone === ACTIVITY_TONES.created) return '[&>td]:bg-success/20'
  if (tone === ACTIVITY_TONES.updated) return '[&>td]:bg-warning/20'
  if (tone === ACTIVITY_TONES.deleted) return '[&>td]:bg-error/15'
  return ''
}

/** Background for a single cell / field with its own entity activity. */
export const activityCellToneClass = (tone) => {
  if (tone === ACTIVITY_TONES.created) return 'bg-success/20'
  if (tone === ACTIVITY_TONES.updated) return 'bg-warning/20'
  if (tone === ACTIVITY_TONES.deleted) return 'bg-error/15'
  return ''
}

/** Text color for a column group that has its own entity activity. */
export const activityTextToneClass = (tone) => {
  if (tone === ACTIVITY_TONES.created) return 'text-success'
  if (tone === ACTIVITY_TONES.updated) return 'text-warning'
  if (tone === ACTIVITY_TONES.deleted) return 'text-error'
  return ''
}

export const ACTIVITY_ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'সব অ্যাকশন' },
  { value: 'created', label: 'তৈরি' },
  { value: 'updated', label: 'আপডেট' },
  { value: 'deleted', label: 'ডিলিট' },
]

export const ACTIVITY_ENTITY_FILTER_OPTIONS = [
  { value: 'all', label: 'সব অডিট' },
  { value: 'daily_record', label: 'হাজিরা' },
  { value: 'site_cash', label: 'ক্যাশ' },
  { value: 'labour_session', label: 'হিসাব' },
  // { value: 'private_site_cash', label: 'প্রাইভেট ক্যাশ' },
  // { value: 'labour', label: 'শ্রমিক' },
  // { value: 'billing_category', label: 'বিলিং' },
  // { value: 'site', label: 'সাইট' },
  // { value: 'user', label: 'ইউজার' },
]

export const ACTIVITY_REVIEWED_FILTER_OPTIONS = [
  { value: 'all', label: 'সব অডিট' },
  { value: 'pending', label: 'অডিট হয়নি' },
  { value: 'reviewed', label: 'অডিট হয়েছে' },
]

export const activityActionLabel = (action) =>
  ACTIVITY_ACTION_FILTER_OPTIONS.find((o) => o.value === action)?.label ??
  action ??
  '—'

export const activityEntityLabel = (entityType) =>
  ACTIVITY_ENTITY_FILTER_OPTIONS.find((o) => o.value === entityType)?.label ??
  entityType ??
  '—'

const formatBusinessDateBn = (isoDate) => {
  if (!isoDate) return null
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(isoDate)
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/** One-line summary for activity list rows. */
export const summarizeActivity = (log) => {
  if (!log) return '—'
  const parts = []
  const biz = formatBusinessDateBn(log.business_date)
  if (biz) parts.push(biz)
  parts.push(activityEntityLabel(log.entity_type))
  parts.push(activityActionLabel(log.action))
  if (log.labour_name) parts.push(log.labour_name)
  else if (log.actor_name) parts.push(log.actor_name)
  return parts.filter(Boolean).join(' · ') || '—'
}

const blankAmount = (value) => {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n : ''
}

/** Flatten create/delete snapshot or update {field:{old,new}} → plain fields. */
export const snapshotFields = (changes) => {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    return {}
  }
  const out = {}
  for (const [key, value] of Object.entries(changes)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      ('old' in value || 'new' in value)
    ) {
      out[key] = value.new !== undefined ? value.new : value.old
    } else {
      out[key] = value
    }
  }
  return out
}

/**
 * Merge unreviwed update logs into per-field { old, new }.
 * Keeps the earliest `old` and the latest `new` when multiple updates stack.
 * Accepts `{old,new}` objects or `[old, new]` tuples.
 */
export const updateFieldDiffs = (logs = []) => {
  const updates = sortByCreatedAt(
    (logs ?? []).filter((l) => l?.action === 'updated'),
  )
  if (!updates.length) return null

  const asPair = (value) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      ('old' in value || 'new' in value)
    ) {
      return { old: value.old, new: value.new }
    }
    if (Array.isArray(value) && value.length >= 2) {
      return { old: value[0], new: value[1] }
    }
    return null
  }

  /** FK snapshots sometimes arrive as `{id, name}` / `{pk, name}`. */
  const unwrap = (side) => {
    if (side && typeof side === 'object' && !Array.isArray(side)) {
      if ('old' in side || 'new' in side) return side
      if ('id' in side || 'pk' in side || 'name' in side) return side
    }
    return side
  }

  const diffs = {}
  for (const log of updates) {
    const changes = log.changes
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      continue
    }
    for (const [key, value] of Object.entries(changes)) {
      const pair = asPair(value)
      if (!pair) continue
      const next = { old: unwrap(pair.old), new: unwrap(pair.new) }
      if (!(key in diffs)) {
        diffs[key] = next
      } else {
        diffs[key] = {
          old: diffs[key].old,
          new: next.new !== undefined ? next.new : diffs[key].new,
        }
      }
    }
  }

  // Common alias: model may log billing_id while API field is billing.
  if (diffs.billing_id && !diffs.billing) {
    diffs.billing = diffs.billing_id
  }

  return Object.keys(diffs).length ? diffs : null
}

const sortByCreatedAt = (logs) =>
  [...logs].sort((a, b) => {
    const ta = new Date(a.created_at).getTime()
    const tb = new Date(b.created_at).getTime()
    return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0)
  })

/**
 * Derive display tone for a group of unreviwed logs.
 * Latest action wins, with deleted > updated > created when mixed.
 */
export const toneFromLogs = (logs) => {
  if (!logs?.length) return null
  const sorted = sortByCreatedAt(logs)
  const latest = sorted[sorted.length - 1]
  if (latest.action === 'deleted') return ACTIVITY_TONES.deleted
  if (logs.some((l) => l.action === 'updated') || latest.action === 'updated') {
    return ACTIVITY_TONES.updated
  }
  if (latest.action === 'created' || logs.some((l) => l.action === 'created')) {
    return ACTIVITY_TONES.created
  }
  return null
}

const strongerTone = (a, b) => {
  const rank = { deleted: 3, updated: 2, created: 1 }
  const ra = rank[a] ?? 0
  const rb = rank[b] ?? 0
  return ra >= rb ? a : b
}

/** Hajira-column fields on DailyRecord activity changes. */
const ATTENDANCE_TONE_KEYS = new Set([
  'present',
  'wage',
  'extra_earn',
  'billing',
  'note',
  'salary',
  'extra',
])

/** Payment-column fields on DailyRecord activity changes. */
const PAYMENT_TONE_KEYS = new Set([
  'fooding_pay',
  'advance_pay',
  'return_amount',
  'payment',
  'advance',
  'return',
  'amount',
  'type',
])

const logTouchesKeys = (log, keys) => {
  if (log?.action === 'created' || log?.action === 'deleted') return true
  const changes = log?.changes
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    return false
  }
  return Object.keys(changes).some((k) => keys.has(k))
}

const toneFromKeyedLogs = (logs, keys) =>
  toneFromLogs((logs ?? []).filter((l) => logTouchesKeys(l, keys)))

const toAttendanceDiffs = (diffs) => {
  if (!diffs) return null
  const out = {}
  for (const key of [
    'present',
    'wage',
    'extra_earn',
    'billing',
    'note',
    'salary',
    'extra',
  ]) {
    if (key in diffs) out[key] = diffs[key]
  }
  // UI row still reads salary/extra.
  if ('wage' in out && !('salary' in out)) out.salary = out.wage
  if ('extra_earn' in out && !('extra' in out)) out.extra = out.extra_earn
  return Object.keys(out).length ? out : null
}

const toPaymentDiffs = (diffs) => {
  if (!diffs) return null
  const out = {}
  if ('fooding_pay' in diffs) {
    out.fooding_pay = diffs.fooding_pay
    out.amount = diffs.fooding_pay
  } else if ('payment' in diffs) {
    out.payment = diffs.payment
    out.amount = diffs.payment
  }
  if ('advance_pay' in diffs) {
    out.advance_pay = diffs.advance_pay
    out.advance = diffs.advance_pay
  } else if ('advance' in diffs) {
    out.advance = diffs.advance
  }
  return Object.keys(out).length ? out : null
}

const toReturnDiffs = (diffs) => {
  if (!diffs) return null
  const out = {}
  if ('return_amount' in diffs) {
    out.return_amount = diffs.return_amount
    out.amount = diffs.return_amount
  } else if ('return' in diffs) {
    out.return = diffs.return
    out.amount = diffs.return
  }
  return Object.keys(out).length ? out : null
}

/** Group daily_record logs by labour id (day uniqueness). */
export const groupDailyRecordLogs = (logs = []) => {
  const map = new Map()
  for (const log of logs) {
    const labourId = log.labour != null ? Number(log.labour) : null
    if (labourId == null || Number.isNaN(labourId)) continue
    const list = map.get(labourId) ?? []
    list.push(log)
    map.set(labourId, list)
  }
  for (const [key, list] of map) map.set(key, sortByCreatedAt(list))
  return map
}

/** @deprecated Prefer groupDailyRecordLogs. */
export const groupAttendanceLogs = groupDailyRecordLogs

const emptyHajiraRow = (labourId, labourName) => ({
  labourId: Number(labourId),
  labourName: labourName || `#${labourId}`,
  defaultAttendance: 0,
  defaultSalary: 0,
  defaultFooding: 0,
  recordId: null,
  recordSealed: false,
  attendanceId: null,
  attendanceSealed: false,
  paymentId: null,
  paymentSealed: false,
  advanceId: null,
  advanceSealed: false,
  returnId: null,
  returnSealed: false,
  recordCreatedAt: null,
  recordUpdatedAt: null,
  attendanceCreatedAt: null,
  attendanceUpdatedAt: null,
  paymentCreatedAt: null,
  paymentUpdatedAt: null,
  advanceCreatedAt: null,
  advanceUpdatedAt: null,
  returnCreatedAt: null,
  returnUpdatedAt: null,
  present: '',
  salary: '',
  extra: 0,
  extraNote: '',
  billing: '',
  payment: '',
  paymentNote: '',
  advance: '',
  advanceNote: '',
  return: '',
  returnNote: '',
})

const applyDailyRecordSnapshot = (row, log) => {
  const fields = snapshotFields(log.changes)
  const id = log.entity_id ?? row.recordId ?? row.attendanceId
  const wage =
    fields.wage != null && fields.wage !== ''
      ? fields.wage
      : fields.salary
  const ts = log.created_at
  return {
    ...row,
    recordId: id,
    attendanceId: id,
    paymentId: id,
    advanceId: id,
    returnId: id,
    present:
      fields.present == null || fields.present === ''
        ? ''
        : Number(fields.present),
    salary: wage == null || wage === '' ? '' : Number(wage),
    extra: Number(fields.extra_earn ?? fields.extra) || 0,
    extraNote: fields.note ?? '',
    billing:
      fields.billing != null && fields.billing !== ''
        ? String(fields.billing)
        : '',
    payment: blankAmount(
      fields.fooding_pay ?? fields.payment ?? fields.amount,
    ),
    advance: blankAmount(fields.advance_pay ?? fields.advance),
    return: blankAmount(fields.return_amount ?? fields.return),
    recordCreatedAt: ts ?? row.recordCreatedAt,
    recordUpdatedAt: ts ?? row.recordUpdatedAt,
    attendanceCreatedAt: ts ?? row.attendanceCreatedAt,
    attendanceUpdatedAt: ts ?? row.attendanceUpdatedAt,
    paymentCreatedAt: ts ?? row.paymentCreatedAt,
    paymentUpdatedAt: ts ?? row.paymentUpdatedAt,
    advanceCreatedAt: ts ?? row.advanceCreatedAt,
    advanceUpdatedAt: ts ?? row.advanceUpdatedAt,
    returnCreatedAt: ts ?? row.returnCreatedAt,
    returnUpdatedAt: ts ?? row.returnUpdatedAt,
  }
}

/**
 * Attach activity tones to view rows and append deleted-only ghost rows.
 * Does not mutate input rows.
 * Signature: (rows, dailyRecordLogs). Third arg still accepted and
 * concatenated for call sites that pass attendance + payment logs.
 */
export const applyActivitiesToViewRows = (
  rows = [],
  dailyRecordLogs = [],
  paymentLogsCompat,
) => {
  const allLogs =
    paymentLogsCompat !== undefined
      ? [...(dailyRecordLogs ?? []), ...(paymentLogsCompat ?? [])]
      : (dailyRecordLogs ?? [])

  const byLabour = groupDailyRecordLogs(allLogs)

  const next = rows.map((row) => {
    const labourId = Number(row.labourId)
    const logs = byLabour.get(labourId)
    if (!logs?.length) return row

    const attendanceTone = toneFromKeyedLogs(logs, ATTENDANCE_TONE_KEYS)
    const paymentTone = toneFromKeyedLogs(logs, PAYMENT_TONE_KEYS)
    const tone =
      strongerTone(attendanceTone, paymentTone) ?? toneFromLogs(logs)
    if (!tone) return row

    const diffs = updateFieldDiffs(logs)
    return {
      ...row,
      activityTone: tone,
      attendanceTone,
      paymentTone,
      activityLogs: logs,
      attendanceDiffs: toAttendanceDiffs(diffs),
      paymentDiffs: toPaymentDiffs(diffs),
      returnDiffs: toReturnDiffs(diffs),
    }
  })

  const liveLabourIds = new Set(rows.map((r) => Number(r.labourId)))
  const ghosts = []

  for (const [labourId, logs] of byLabour) {
    if (liveLabourIds.has(labourId)) continue
    const attendanceTone = toneFromKeyedLogs(logs, ATTENDANCE_TONE_KEYS)
    const paymentTone = toneFromKeyedLogs(logs, PAYMENT_TONE_KEYS)
    const tone =
      strongerTone(attendanceTone, paymentTone) ?? toneFromLogs(logs)
    if (!tone) continue

    const sorted = sortByCreatedAt(logs)
    const snapshotLog =
      [...sorted].reverse().find((l) => l.action === 'deleted') ??
      [...sorted].reverse().find((l) => l.action === 'created') ??
      sorted[sorted.length - 1]

    let ghost = emptyHajiraRow(
      labourId,
      snapshotLog.labour_name || `#${labourId}`,
    )
    ghost = applyDailyRecordSnapshot(ghost, snapshotLog)
    const diffs = updateFieldDiffs(logs)

    ghosts.push({
      ...ghost,
      activityTone: tone,
      attendanceTone,
      paymentTone,
      activityLogs: logs,
      attendanceDiffs: toAttendanceDiffs(diffs),
      paymentDiffs: toPaymentDiffs(diffs),
      returnDiffs: toReturnDiffs(diffs),
      fromActivitySnapshot: true,
    })
  }

  if (!ghosts.length) return next

  return [...next, ...ghosts].sort((a, b) =>
    String(a.labourName).localeCompare(String(b.labourName), 'bn'),
  )
}

/** Group site_cash / private_site_cash logs by entity_id. */
export const groupCashLogs = (logs = []) => {
  const map = new Map()
  for (const log of logs) {
    const entityId = log.entity_id != null ? Number(log.entity_id) : null
    if (entityId == null || Number.isNaN(entityId)) continue
    const list = map.get(entityId) ?? []
    list.push(log)
    map.set(entityId, list)
  }
  for (const [key, list] of map) map.set(key, sortByCreatedAt(list))
  return map
}

const cashRowFromSnapshot = (log) => {
  const fields = snapshotFields(log.changes)
  const billing =
    fields.billing != null && fields.billing !== ''
      ? Number(fields.billing)
      : null
  return {
    id: log.entity_id,
    date: fields.date ?? log.business_date ?? null,
    type: fields.type || 'cost',
    amount: Number(fields.amount) || 0,
    note: fields.note ?? '',
    billing: Number.isFinite(billing) ? billing : null,
    created_at: log.created_at ?? null,
    updated_at: log.created_at ?? null,
    fromActivitySnapshot: true,
  }
}

/**
 * Attach activity tones to labour-session daily-record rows (keyed by date).
 * Matches logs by entity_id (record id) first, then business_date.
 */
export const applyActivitiesToSessionRows = (rows = [], logs = []) => {
  const dailyLogs = (logs ?? []).filter(
    (log) => !log.entity_type || log.entity_type === 'daily_record',
  )

  const byEntity = new Map()
  const byDate = new Map()
  for (const log of dailyLogs) {
    const entityId =
      log.entity_id != null ? Number(log.entity_id) : null
    if (Number.isFinite(entityId)) {
      const list = byEntity.get(entityId) ?? []
      list.push(log)
      byEntity.set(entityId, list)
    }
    if (log.business_date) {
      const list = byDate.get(log.business_date) ?? []
      list.push(log)
      byDate.set(log.business_date, list)
    }
  }
  for (const [key, list] of byEntity) byEntity.set(key, sortByCreatedAt(list))
  for (const [key, list] of byDate) byDate.set(key, sortByCreatedAt(list))

  return rows.map((row) => {
    const recordId = row.recordId ?? row.attendanceId
    let rowLogs =
      recordId != null ? byEntity.get(Number(recordId)) : null
    if (!rowLogs?.length && row.date) {
      rowLogs = byDate.get(row.date)
    }
    if (!rowLogs?.length) return row

    const tone = toneFromLogs(rowLogs)
    if (!tone) return row

    return {
      ...row,
      activityTone: tone,
      activityLogs: rowLogs,
    }
  })
}

/**
 * SiteCashList.pending_activities: [{ id, action }, ...].
 */
export const pendingActivitiesOf = (row) => {
  const list = row?.pending_activities
  return Array.isArray(list) ? list : []
}

/**
 * Attach row audit tone from SiteCashList.pending_activities.
 * Does not mutate input rows.
 */
export const applyPendingActivitiesToCashRows = (rows = []) =>
  rows.map((row) => {
    const logs = pendingActivitiesOf(row)
    if (!logs.length) return row
    return {
      ...row,
      activityTone: toneFromLogs(logs),
      activityLogs: logs,
    }
  })

/**
 * Attach hajira row tones from SiteDailyRecordList.pending_activities.
 * Pending items are `{ id, action }` only — no field diffs / column split.
 */
export const applyPendingActivitiesToHajiraRows = (rows = []) =>
  rows.map((row) => {
    const logs = pendingActivitiesOf(row)
    if (!logs.length) return row
    const tone = toneFromLogs(logs)
    if (!tone) return row
    return {
      ...row,
      activityTone: tone,
      attendanceTone: tone,
      paymentTone: tone,
      activityLogs: logs,
    }
  })

/**
 * Attach activity tones to cash rows and append deleted-only ghost rows.
 * Does not mutate input rows. Totals should use live rows only.
 */
export const applyActivitiesToCashRows = (rows = [], cashLogs = []) => {
  const byEntity = groupCashLogs(cashLogs)

  const next = rows.map((row) => {
    const logs = byEntity.get(Number(row.id))
    if (!logs?.length) return row
    return {
      ...row,
      activityTone: toneFromLogs(logs),
      activityLogs: logs,
      activityDiffs: updateFieldDiffs(logs),
    }
  })

  const liveIds = new Set(rows.map((r) => Number(r.id)))
  const ghosts = []

  for (const [entityId, logs] of byEntity) {
    if (liveIds.has(entityId)) continue
    const tone = toneFromLogs(logs)
    if (!tone) continue
    const sorted = sortByCreatedAt(logs)
    const snapshotLog =
      [...sorted].reverse().find((l) => l.action === 'deleted') ??
      [...sorted].reverse().find((l) => l.action === 'created') ??
      sorted[sorted.length - 1]

    ghosts.push({
      ...cashRowFromSnapshot(snapshotLog),
      activityTone: tone,
      activityLogs: logs,
      activityDiffs: updateFieldDiffs(logs),
    })
  }

  if (!ghosts.length) return next
  return [...next, ...ghosts]
}
