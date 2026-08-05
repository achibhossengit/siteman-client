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
  { value: 'all', label: 'সব অ্যাক্টিভিটি' },
  { value: 'attendance', label: 'হাজিরা' },
  { value: 'labour_payment', label: 'পেমেন্ট' },
  { value: 'site_cash', label: 'ক্যাশ' },
  // { value: 'private_site_cash', label: 'প্রাইভেট ক্যাশ' },
  // { value: 'labour', label: 'লেবার' },
  // { value: 'labour_session', label: 'সেশন' },
  // { value: 'billing_category', label: 'বিলিং' },
  // { value: 'site', label: 'সাইট' },
  // { value: 'user', label: 'ইউজার' },
]

export const ACTIVITY_REVIEWED_FILTER_OPTIONS = [
  { value: 'all', label: 'সব অ্যাক্টিভিটি' },
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

const paymentTypeFromLog = (log) => {
  const fields = snapshotFields(log?.changes)
  const type = fields.type
  if (type === 'payment' || type === 'return') return type
  return null
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

/** Group attendance logs by labour id (day uniqueness). */
export const groupAttendanceLogs = (logs = []) => {
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

/**
 * Group payment logs by labour + type.
 * Key: `${labourId}:${type}` where type is payment|return.
 * Type is taken from snapshot, or inferred via entity_id from live rows / sibling logs.
 */
export const groupPaymentLogs = (logs = [], liveRows = []) => {
  const entityToType = new Map()

  for (const row of liveRows) {
    if (row.paymentId != null) {
      entityToType.set(Number(row.paymentId), 'payment')
    }
    if (row.returnId != null) {
      entityToType.set(Number(row.returnId), 'return')
    }
  }

  for (const log of logs) {
    const type = paymentTypeFromLog(log)
    if (type && log.entity_id != null) {
      entityToType.set(Number(log.entity_id), type)
    }
  }

  const map = new Map()
  for (const log of logs) {
    const labourId = log.labour != null ? Number(log.labour) : null
    if (labourId == null || Number.isNaN(labourId)) continue
    const type =
      paymentTypeFromLog(log) ??
      (log.entity_id != null
        ? entityToType.get(Number(log.entity_id))
        : null)
    if (!type) continue
    const key = `${labourId}:${type}`
    const list = map.get(key) ?? []
    list.push(log)
    map.set(key, list)
  }
  for (const [key, list] of map) map.set(key, sortByCreatedAt(list))
  return map
}

const emptyHajiraRow = (labourId, labourName) => ({
  labourId: Number(labourId),
  labourName: labourName || `#${labourId}`,
  defaultAttendance: 0,
  defaultSalary: 0,
  defaultFooding: 0,
  attendanceId: null,
  attendanceSealed: false,
  attendanceCreatedAt: null,
  attendanceUpdatedAt: null,
  present: '',
  salary: '',
  extra: 0,
  extraNote: '',
  billing: '',
  paymentId: null,
  paymentSealed: false,
  payment: '',
  paymentNote: '',
  paymentCreatedAt: null,
  paymentUpdatedAt: null,
  returnId: null,
  returnSealed: false,
  return: '',
  returnNote: '',
  returnCreatedAt: null,
  returnUpdatedAt: null,
})

const applyAttendanceSnapshot = (row, log) => {
  const fields = snapshotFields(log.changes)
  return {
    ...row,
    attendanceId: log.entity_id ?? row.attendanceId,
    present:
      fields.present == null || fields.present === ''
        ? ''
        : Number(fields.present),
    salary:
      fields.salary == null || fields.salary === ''
        ? ''
        : Number(fields.salary),
    extra: Number(fields.extra) || 0,
    extraNote: fields.note ?? '',
    billing:
      fields.billing != null && fields.billing !== ''
        ? String(fields.billing)
        : '',
    attendanceCreatedAt: log.created_at ?? row.attendanceCreatedAt,
    attendanceUpdatedAt: log.created_at ?? row.attendanceUpdatedAt,
  }
}

const applyPaymentSnapshot = (row, log, type) => {
  const fields = snapshotFields(log.changes)
  if (type === 'return') {
    return {
      ...row,
      returnId: log.entity_id ?? row.returnId,
      return: blankAmount(fields.amount),
      returnNote: fields.note ?? '',
      returnCreatedAt: log.created_at ?? row.returnCreatedAt,
      returnUpdatedAt: log.created_at ?? row.returnUpdatedAt,
    }
  }
  return {
    ...row,
    paymentId: log.entity_id ?? row.paymentId,
    payment: blankAmount(fields.amount),
    paymentNote: fields.note ?? '',
    paymentCreatedAt: log.created_at ?? row.paymentCreatedAt,
    paymentUpdatedAt: log.created_at ?? row.paymentUpdatedAt,
  }
}

/**
 * Attach activity tones to view rows and append deleted-only ghost rows.
 * Does not mutate input rows.
 */
export const applyActivitiesToViewRows = (
  rows = [],
  attendanceLogs = [],
  paymentLogs = [],
) => {
  const attendanceByLabour = groupAttendanceLogs(attendanceLogs)
  const paymentByKey = groupPaymentLogs(paymentLogs, rows)

  const usedPaymentKeys = new Set()

  const next = rows.map((row) => {
    const labourId = Number(row.labourId)
    let attendanceTone = null
    let paymentTone = null
    const logs = []

    const attLogs = attendanceByLabour.get(labourId)
    if (attLogs?.length) {
      logs.push(...attLogs)
      attendanceTone = toneFromLogs(attLogs)
    }

    for (const type of ['payment', 'return']) {
      const key = `${labourId}:${type}`
      const payLogs = paymentByKey.get(key)
      if (!payLogs?.length) continue
      usedPaymentKeys.add(key)
      logs.push(...payLogs)
      paymentTone = strongerTone(paymentTone, toneFromLogs(payLogs))
    }

    const tone = strongerTone(attendanceTone, paymentTone)
    if (!tone) return row
    return {
      ...row,
      activityTone: tone,
      attendanceTone,
      paymentTone,
      activityLogs: logs,
      attendanceDiffs: updateFieldDiffs(attLogs),
      paymentDiffs: updateFieldDiffs(paymentByKey.get(`${labourId}:payment`)),
      returnDiffs: updateFieldDiffs(paymentByKey.get(`${labourId}:return`)),
    }
  })

  const liveLabourIds = new Set(rows.map((r) => Number(r.labourId)))
  const ghosts = []

  for (const [labourId, attLogs] of attendanceByLabour) {
    if (liveLabourIds.has(labourId)) continue
    const attendanceTone = toneFromLogs(attLogs)
    if (!attendanceTone) continue
    const sorted = sortByCreatedAt(attLogs)
    const snapshotLog =
      [...sorted].reverse().find((l) => l.action === 'deleted') ??
      [...sorted].reverse().find((l) => l.action === 'created') ??
      sorted[sorted.length - 1]

    let ghost = emptyHajiraRow(
      labourId,
      snapshotLog.labour_name || `#${labourId}`,
    )
    ghost = applyAttendanceSnapshot(ghost, snapshotLog)

    const relatedLogs = [...attLogs]
    let paymentTone = null
    let paymentDiffs = null
    let returnDiffs = null

    for (const type of ['payment', 'return']) {
      const key = `${labourId}:${type}`
      const payLogs = paymentByKey.get(key)
      if (!payLogs?.length) continue
      usedPaymentKeys.add(key)
      relatedLogs.push(...payLogs)
      paymentTone = strongerTone(paymentTone, toneFromLogs(payLogs))
      const paySorted = sortByCreatedAt(payLogs)
      const paySnap =
        [...paySorted].reverse().find((l) => l.action === 'deleted') ??
        [...paySorted].reverse().find((l) => l.action === 'created') ??
        paySorted[paySorted.length - 1]
      ghost = applyPaymentSnapshot(ghost, paySnap, type)
      if (type === 'payment') paymentDiffs = updateFieldDiffs(payLogs)
      if (type === 'return') returnDiffs = updateFieldDiffs(payLogs)
    }

    ghosts.push({
      ...ghost,
      activityTone: strongerTone(attendanceTone, paymentTone),
      attendanceTone,
      paymentTone,
      activityLogs: relatedLogs,
      attendanceDiffs: updateFieldDiffs(attLogs),
      paymentDiffs,
      returnDiffs,
      fromActivitySnapshot: true,
    })
    liveLabourIds.add(labourId)
  }

  for (const [key, payLogs] of paymentByKey) {
    if (usedPaymentKeys.has(key)) continue
    const [labourIdRaw, type] = key.split(':')
    const labourId = Number(labourIdRaw)
    if (liveLabourIds.has(labourId)) {
      // Live row existed but payment group wasn't attached (shouldn't happen).
      continue
    }
    const paymentTone = toneFromLogs(payLogs)
    if (!paymentTone) continue
    const sorted = sortByCreatedAt(payLogs)
    const snapshotLog =
      [...sorted].reverse().find((l) => l.action === 'deleted') ??
      [...sorted].reverse().find((l) => l.action === 'created') ??
      sorted[sorted.length - 1]

    let ghost = emptyHajiraRow(
      labourId,
      snapshotLog.labour_name || `#${labourId}`,
    )
    ghost = applyPaymentSnapshot(ghost, snapshotLog, type)
    ghosts.push({
      ...ghost,
      activityTone: paymentTone,
      attendanceTone: null,
      paymentTone,
      activityLogs: payLogs,
      attendanceDiffs: null,
      paymentDiffs: type === 'payment' ? updateFieldDiffs(payLogs) : null,
      returnDiffs: type === 'return' ? updateFieldDiffs(payLogs) : null,
      fromActivitySnapshot: true,
    })
    liveLabourIds.add(labourId)
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
    category: fields.category ?? null,
    amount: Number(fields.amount) || 0,
    note: fields.note ?? '',
    billing: Number.isFinite(billing) ? billing : null,
    created_at: log.created_at ?? null,
    updated_at: log.created_at ?? null,
    fromActivitySnapshot: true,
  }
}

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
