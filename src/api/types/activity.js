/**
 * Activity-log helpers for হাজিরা view-mode coloring.
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
    let tone = null
    const logs = []

    const attLogs = attendanceByLabour.get(labourId)
    if (attLogs?.length) {
      logs.push(...attLogs)
      tone = strongerTone(tone, toneFromLogs(attLogs))
    }

    for (const type of ['payment', 'return']) {
      const key = `${labourId}:${type}`
      const payLogs = paymentByKey.get(key)
      if (!payLogs?.length) continue
      usedPaymentKeys.add(key)
      logs.push(...payLogs)
      tone = strongerTone(tone, toneFromLogs(payLogs))
    }

    if (!tone) return row
    return {
      ...row,
      activityTone: tone,
      activityLogs: logs,
    }
  })

  const liveLabourIds = new Set(rows.map((r) => Number(r.labourId)))
  const ghosts = []

  for (const [labourId, attLogs] of attendanceByLabour) {
    if (liveLabourIds.has(labourId)) continue
    const tone = toneFromLogs(attLogs)
    if (!tone) continue
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
    let combinedTone = tone

    for (const type of ['payment', 'return']) {
      const key = `${labourId}:${type}`
      const payLogs = paymentByKey.get(key)
      if (!payLogs?.length) continue
      usedPaymentKeys.add(key)
      relatedLogs.push(...payLogs)
      combinedTone = strongerTone(combinedTone, toneFromLogs(payLogs))
      const paySorted = sortByCreatedAt(payLogs)
      const paySnap =
        [...paySorted].reverse().find((l) => l.action === 'deleted') ??
        [...paySorted].reverse().find((l) => l.action === 'created') ??
        paySorted[paySorted.length - 1]
      ghost = applyPaymentSnapshot(ghost, paySnap, type)
    }

    ghosts.push({
      ...ghost,
      activityTone: combinedTone,
      activityLogs: relatedLogs,
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
    const tone = toneFromLogs(payLogs)
    if (!tone) continue
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
      activityTone: tone,
      activityLogs: payLogs,
      fromActivitySnapshot: true,
    })
    liveLabourIds.add(labourId)
  }

  if (!ghosts.length) return next

  return [...next, ...ghosts].sort((a, b) =>
    String(a.labourName).localeCompare(String(b.labourName), 'bn'),
  )
}
