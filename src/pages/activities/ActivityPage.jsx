import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { fetchActivities, reviewActivities } from '../../api/activities.js'
import { fetchLabourDailyRecordDetail } from '../../api/labours.js'
import {
  fetchPrivateSiteCashDetail,
  fetchSiteCashDetail,
} from '../../api/sites.js'
import {
  ACTIVITY_ACTION_FILTER_OPTIONS,
  ACTIVITY_ENTITY_FILTER_OPTIONS,
  ACTIVITY_REVIEWED_FILTER_OPTIONS,
  activityEntityLabel,
  activityTextToneClass,
  activityToneClass,
  snapshotFields,
} from '../../api/types/activity.js'
import {
  cashTypeLabel,
} from '../../api/types/siteCash.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { useAssignedSites } from '../../hooks/useSites.js'
import { confirmAction, toastApiError, toastSuccess } from '../../utils/feedback.js'
import { formatBnNumber, NULL_BILLING_LABEL, STATUS_LABEL } from '../../utils/format.js'
import { PERMS, hasPermissionSuffix } from '../../utils/permissions.js'
import {
  readSelectedSite,
  todayIso,
  writeSelectedSite,
} from '../../utils/sessionSelection.js'

const PAGE_SIZE = 20
const DETAIL_MODAL_ID = 'activity_detail_modal'
const DATE_FILTER_MODAL_ID = 'activity_date_filter_modal'

const dayStartIso = (dateStr) => `${dateStr}T00:00:00`
const dayEndIso = (dateStr) => `${dateStr}T23:59:59.999`

const FIELD_LABELS_BN = {
  present: 'হাজিরা',
  salary: 'বেতন',
  wage: 'বেতন',
  extra: 'বাড়তি',
  extra_earn: 'বাড়তি',
  fooding_pay: 'ফুডিং',
  advance_pay: 'অ্যাডভান্স',
  return_amount: 'রিটার্ন',
  note: 'নোট',
  billing: 'বিলিং',
  billing_id: 'বিলিং',
  amount: 'পরিমাণ',
  type: 'ধরন',
  category: 'ক্যাটাগরি',
  date: 'তারিখ',
  name: 'নাম',
  phone: 'ফোন',
  active: STATUS_LABEL.active,
  closed: STATUS_LABEL.closed,
  default_attendance: 'ডিফল্ট হাজিরা',
  current_site: 'বর্তমান সাইট',
}

const formatDateTimeBn = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

const formatDateTimePartsBn = (iso) => {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' }
  return {
    date: new Intl.DateTimeFormat('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    }).format(d),
    time: new Intl.DateTimeFormat('bn-BD', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d),
  }
}

const DateTimeStacked = ({ iso, className = '' }) => {
  const { date, time } = formatDateTimePartsBn(iso)
  return (
    <span
      className={['inline-flex flex-col leading-tight', className]
        .filter(Boolean)
        .join(' ')}
    >
      <span>{date}</span>
      {time ? <span>{time}</span> : null}
    </span>
  )
}

const formatDateBn = (isoDate) => {
  if (!isoDate) return null
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(isoDate)
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  }).format(d)
}

const createdAtFilterParams = (mode, specificDate, startDate, endDate) => {
  if (mode === 'day' && specificDate) {
    return {
      created_at__gte: dayStartIso(specificDate),
      created_at__lte: dayEndIso(specificDate),
    }
  }
  if (mode === 'range') {
    return {
      ...(startDate ? { created_at__gte: dayStartIso(startDate) } : {}),
      ...(endDate ? { created_at__lte: dayEndIso(endDate) } : {}),
    }
  }
  return {}
}

const dateFilterHeaderLabel = (mode, specificDate, startDate, endDate) => {
  if (mode === 'day' && specificDate) {
    return formatDateBn(specificDate) || 'অ্যাকশন তারিখ'
  }
  if (mode === 'range' && (startDate || endDate)) {
    const a = formatDateBn(startDate) || '…'
    const b = formatDateBn(endDate) || '…'
    return (
      <span className="inline-flex flex-col items-end leading-tight">
        <span>{a}</span>
        <span>{b}</span>
      </span>
    )
  }
  if (mode === 'all') return 'সব তারিখ'
  return 'অ্যাকশন তারিখ'
}

const fieldLabel = (key) => FIELD_LABELS_BN[key] ?? key

const formatChangeValue = (value) => {
  if (value == null || value === '' || value === 'None' || value === 'null') {
    return '—'
  }
  if (typeof value === 'boolean') return value ? 'হ্যাঁ' : 'না'
  if (typeof value === 'object') {
    if (!Array.isArray(value)) {
      if (value.name != null && value.name !== '') return String(value.name)
      const id = value.id ?? value.pk
      if (id != null && id !== '') return String(id)
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const sameDisplay = (a, b) => String(a ?? '') === String(b ?? '')

const RECORD_FIELD_KEYS = {
  site_cash: ['date', 'type', 'amount', 'note', 'billing'],
  private_site_cash: ['date', 'type', 'amount', 'note', 'billing'],
  daily_record: [
    'date',
    'present',
    'wage',
    'extra_earn',
    'fooding_pay',
    'advance_pay',
    'return_amount',
    'note',
    'billing',
  ],
}

const formatRecordValue = (key, value) => {
  if (value == null || value === '' || value === 'None' || value === 'null') {
    if (key === 'billing' || key === 'billing_id') return NULL_BILLING_LABEL
    return '—'
  }
  if (key === 'type') {
    if (value === 'payment') return 'পেমেন্ট'
    if (value === 'return') return 'রিটার্ন'
    return cashTypeLabel(value)
  }
  if (key === 'billing' || key === 'billing_id') {
    if (typeof value === 'object') {
      if (value.name) return String(value.name)
      const id = value.id ?? value.pk
      return id == null || id === '' ? NULL_BILLING_LABEL : String(id)
    }
    return String(value)
  }
  if (key === 'date' || key === 'business_date') {
    return formatDateBn(value) ?? String(value)
  }
  return formatChangeValue(value)
}

const pickRecordEntries = (entityType, data) => {
  if (!data || typeof data !== 'object') return []
  const keys = RECORD_FIELD_KEYS[entityType]
  const source = keys?.length
    ? keys.filter((key) => data[key] !== undefined)
    : Object.keys(data).filter(
        (key) =>
          !['id', 'created_at', 'updated_at', 'site', 'labour', 'is_sealed'].includes(
            key,
          ),
      )
  return source.map((key) => ({ key, value: data[key] }))
}

const canLoadEntityRecord = (log) => {
  if (!log || log.action === 'deleted') return false
  if (log.entity_id == null || log.entity_id === '') return false
  if (log.entity_type === 'daily_record') {
    return log.labour != null && log.labour !== ''
  }
  if (
    log.entity_type === 'site_cash' ||
    log.entity_type === 'private_site_cash'
  ) {
    return log.site != null && log.site !== ''
  }
  return false
}

const fetchEntityRecord = async (log) => {
  const id = log.entity_id
  if (log.entity_type === 'site_cash') {
    const { data } = await fetchSiteCashDetail(log.site, id)
    return data
  }
  if (log.entity_type === 'private_site_cash') {
    const { data } = await fetchPrivateSiteCashDetail(log.site, id)
    return data
  }
  if (log.entity_type === 'daily_record') {
    const { data } = await fetchLabourDailyRecordDetail(log.labour, id)
    return data
  }
  return null
}

const summarizeHistoryLog = (log) => {
  if (!log) return '—'
  const fields = snapshotFields(log.changes)
  const bits = []
  if (fields.note) bits.push(String(fields.note))
  else if (fields.amount != null && fields.amount !== '') {
    bits.push(String(fields.amount))
  } else if (fields.present != null && fields.present !== '') {
    bits.push(`হাজিরা ${fields.present}`)
  }
  if (!bits.length && log.labour_name) bits.push(log.labour_name)
  return bits.join(' · ') || activityEntityLabel(log.entity_type)
}

/** List-row subtitle: site cash note (strikethrough when updated). */
const cashNoteFromLog = (log) => {
  if (
    !log ||
    (log.entity_type !== 'site_cash' &&
      log.entity_type !== 'private_site_cash')
  ) {
    return null
  }
  const raw = log.changes?.note
  if (
    log.action === 'updated' &&
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    ('old' in raw || 'new' in raw)
  ) {
    const oldText =
      raw.old == null || raw.old === '' ? null : String(raw.old)
    const newText =
      raw.new == null || raw.new === '' ? '—' : String(raw.new)
    if (oldText == null && (raw.new == null || raw.new === '')) return null
    return { isDiff: true, oldText, newText }
  }
  if (
    log.action === 'updated' &&
    Array.isArray(raw) &&
    raw.length >= 2
  ) {
    const oldText = raw[0] == null || raw[0] === '' ? null : String(raw[0])
    const newText = raw[1] == null || raw[1] === '' ? '—' : String(raw[1])
    if (oldText == null && (raw[1] == null || raw[1] === '')) return null
    return { isDiff: true, oldText, newText }
  }
  const note = snapshotFields(log.changes).note
  if (note == null || note === '') return null
  return { isDiff: false, text: String(note) }
}

/** One-line বিবরণ: update diffs with strikethrough, concatenated. */
const HistoryBiboron = ({ log }) => {
  if (!log) return '—'
  if (log.action === 'updated') {
    const entries = changeEntries(log.changes).filter((entry) => entry.isDiff)
    if (!entries.length) return '—'
    return (
      <span className="inline">
        {entries.map((entry, index) => (
          <Fragment key={entry.key}>
            {index > 0 ? <span className="text-base-content/40"> · </span> : null}
            <ChangePair
              oldText={formatRecordValue(entry.key, entry.old)}
              newText={formatRecordValue(entry.key, entry.next)}
            />
          </Fragment>
        ))}
      </span>
    )
  }
  return summarizeHistoryLog(log)
}

const changeEntries = (changes) => {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    return []
  }
  return Object.entries(changes).map(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      ('old' in value || 'new' in value)
    ) {
      return { key, isDiff: true, old: value.old, next: value.new }
    }
    if (Array.isArray(value) && value.length >= 2) {
      return { key, isDiff: true, old: value[0], next: value[1] }
    }
    return { key, isDiff: false, value }
  })
}

const ChangePair = ({ oldText, newText }) => {
  if (oldText == null || sameDisplay(oldText, newText)) {
    return <span>{newText}</span>
  }
  return (
    <span className="inline whitespace-nowrap">
      <span className="line-through opacity-50">{oldText}</span>
      <span> {newText}</span>
    </span>
  )
}

const MetaRow = ({ label, children }) => (
  <div className="flex gap-3 text-sm">
    <span className="w-28 shrink-0 text-base-content/60">{label}</span>
    <span className="min-w-0 wrap-break-word">{children}</span>
  </div>
)

const shortActionLabel = (action) => {
  if (action === 'updated') return 'আপডেট'
  if (action === 'deleted') return 'ডিলিট'
  return 'তৈরি'
}

const ALLOWED_ACTIONS = new Set(
  ACTIVITY_ACTION_FILTER_OPTIONS.map((o) => o.value),
)
const ALLOWED_ENTITIES = new Set(
  ACTIVITY_ENTITY_FILTER_OPTIONS.map((o) => o.value),
)
const ALLOWED_REVIEWED = new Set(
  ACTIVITY_REVIEWED_FILTER_OPTIONS.map((o) => o.value),
)
const ALLOWED_DATE_MODES = new Set(['all', 'day', 'range'])
const SITE_ALL = 'all'

const readFilterParam = (params, key, allowed, fallback) => {
  const value = params.get(key)
  if (value && allowed.has(value)) return value
  return fallback
}

const readSiteParam = (params) => {
  const value = params.get('site')
  if (value === SITE_ALL) return SITE_ALL
  if (value) return value
  return ''
}

const filtersToSearchParams = ({
  siteId,
  actionFilter,
  entityFilter,
  reviewedFilter,
  dateMode,
  specificDate,
  startDate,
  endDate,
  page,
}) => {
  const params = new URLSearchParams()
  if (siteId === SITE_ALL) params.set('site', SITE_ALL)
  else if (siteId) params.set('site', String(siteId))
  if (actionFilter !== 'all') params.set('action', actionFilter)
  if (entityFilter !== 'all') params.set('entity', entityFilter)
  if (reviewedFilter !== 'pending') params.set('reviewed', reviewedFilter)
  if (dateMode !== 'all') params.set('date_mode', dateMode)
  if (dateMode === 'day' && specificDate) params.set('date', specificDate)
  if (dateMode === 'range') {
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
  }
  if (page > 1) params.set('page', String(page))
  return params
}

const sameSearchParams = (a, b) => {
  const keys = new Set([...a.keys(), ...b.keys()])
  for (const key of keys) {
    if ((a.get(key) ?? '') !== (b.get(key) ?? '')) return false
  }
  return true
}

export const ActivityPage = () => {
  const queryClient = useQueryClient()
  const dialogRef = useRef(null)
  const skipPageReset = useRef(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const { can, profile } = usePermissions()
  const { assignedSites: sites } = useAssignedSites({ includeClosed: false })

  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, 'view_activitylog')
  const canChangeActivityLog =
    can(PERMS.changeActivityLog) ||
    hasPermissionSuffix(profile, 'change_activitylog')

  const [siteId, setSiteId] = useState(
    () => readSiteParam(searchParams) || readSelectedSite() || '',
  )
  const [actionFilter, setActionFilter] = useState(() =>
    readFilterParam(searchParams, 'action', ALLOWED_ACTIONS, 'all'),
  )
  const [entityFilter, setEntityFilter] = useState(() =>
    readFilterParam(searchParams, 'entity', ALLOWED_ENTITIES, 'all'),
  )
  const [reviewedFilter, setReviewedFilter] = useState(() =>
    readFilterParam(searchParams, 'reviewed', ALLOWED_REVIEWED, 'pending'),
  )
  const [dateMode, setDateMode] = useState(() =>
    readFilterParam(searchParams, 'date_mode', ALLOWED_DATE_MODES, 'all'),
  )
  const [specificDate, setSpecificDate] = useState(
    () => searchParams.get('date') || todayIso(),
  )
  const [startDate, setStartDate] = useState(
    () => searchParams.get('start') || todayIso(),
  )
  const [endDate, setEndDate] = useState(
    () => searchParams.get('end') || todayIso(),
  )
  const [draftDateMode, setDraftDateMode] = useState('all')
  const [draftSpecificDate, setDraftSpecificDate] = useState(() => todayIso())
  const [draftStartDate, setDraftStartDate] = useState(() => todayIso())
  const [draftEndDate, setDraftEndDate] = useState(() => todayIso())
  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get('page'))
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
  })
  const [selected, setSelected] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [reviewing, setReviewing] = useState(false)
  const [modalView, setModalView] = useState('history') // history | record
  const [expandedHistoryId, setExpandedHistoryId] = useState(null)

  // Prefer URL/session site when still in list; otherwise first available site.
  useEffect(() => {
    if (siteId === SITE_ALL) return
    if (!sites.length) {
      setSiteId(SITE_ALL)
      return
    }
    const stillValid = sites.some((s) => String(s.id) === String(siteId))
    if (stillValid) return
    const saved = readSelectedSite()
    const savedValid = sites.some((s) => String(s.id) === String(saved))
    const next = String(savedValid ? saved : sites[0].id)
    setSiteId(next)
    writeSelectedSite(next)
  }, [sites, siteId])

  useEffect(() => {
    if (siteId && siteId !== SITE_ALL) writeSelectedSite(siteId)
  }, [siteId])

  // Keep filters in the URL so refresh restores them.
  useEffect(() => {
    const next = filtersToSearchParams({
      siteId,
      actionFilter,
      entityFilter,
      reviewedFilter,
      dateMode,
      specificDate,
      startDate,
      endDate,
      page,
    })
    if (!sameSearchParams(next, searchParams)) {
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync outward from state
  }, [
    siteId,
    actionFilter,
    entityFilter,
    reviewedFilter,
    dateMode,
    specificDate,
    startDate,
    endDate,
    page,
  ])

  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false
      return
    }
    setPage(1)
    setSelectedIds(new Set())
  }, [
    siteId,
    actionFilter,
    entityFilter,
    reviewedFilter,
    dateMode,
    specificDate,
    startDate,
    endDate,
  ])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [page])

  const dateParams = createdAtFilterParams(
    dateMode,
    specificDate,
    startDate,
    endDate,
  )

  const activitiesQuery = useQuery({
    queryKey: [
      'activities',
      'list',
      {
        site: siteId,
        action: actionFilter,
        entity_type: entityFilter,
        reviewed: reviewedFilter,
        dateMode,
        specificDate,
        startDate,
        endDate,
        page,
        page_size: PAGE_SIZE,
      },
    ],
    queryFn: async () => {
      const { data } = await fetchActivities({
        page,
        page_size: PAGE_SIZE,
        ...(siteId && siteId !== SITE_ALL ? { site: siteId } : {}),
        ...dateParams,
        ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
        ...(entityFilter !== 'all' ? { entity_type: entityFilter } : {}),
        ...(reviewedFilter === 'pending' ? { reviewed: false } : {}),
        ...(reviewedFilter === 'reviewed' ? { reviewed: true } : {}),
      })
      return data
    },
    enabled: Boolean(canViewActivityLog && siteId),
    placeholderData: (previousData) => previousData,
  })

  const historyQuery = useQuery({
    queryKey: [
      'activities',
      {
        site: selected?.site,
        business_date: selected?.business_date,
        entity_type: selected?.entity_type,
        entity_id: selected?.entity_id,
      },
    ],
    queryFn: async () => {
      const { data } = await fetchActivities({
        site: selected.site,
        business_date: selected.business_date,
        entity_type: selected.entity_type,
        entity_id: selected.entity_id,
        page: 1,
        page_size: 100,
      })
      return data?.results ?? []
    },
    enabled: Boolean(
      selected &&
        modalView === 'history' &&
        selected.site &&
        selected.business_date &&
        selected.entity_type &&
        selected.entity_id != null &&
        selected.entity_id !== '',
    ),
  })

  const historyLogs = useMemo(() => {
    const logs = historyQuery.data ?? []
    const sorted = [...logs].sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
    if (!selected) return sorted
    if (sorted.some((log) => String(log.id) === String(selected.id))) {
      return sorted
    }
    return [selected, ...sorted]
  }, [historyQuery.data, selected])

  const recordQuery = useQuery({
    queryKey: [
      'activity-record',
      selected?.entity_type,
      selected?.entity_id,
      selected?.site,
      selected?.labour,
    ],
    queryFn: () => fetchEntityRecord(selected),
    enabled: Boolean(
      selected && modalView === 'record' && canLoadEntityRecord(selected),
    ),
  })

  const recordEntries = useMemo(() => {
    if (!selected) return []
    if (selected.action === 'deleted' || !canLoadEntityRecord(selected)) {
      return pickRecordEntries(
        selected.entity_type,
        snapshotFields(selected.changes),
      )
    }
    if (!recordQuery.data) return []
    return pickRecordEntries(selected.entity_type, recordQuery.data)
  }, [selected, recordQuery.data])

  const openDetail = (row) => {
    setApiError(null)
    setSelected(row)
    setModalView('history')
    setExpandedHistoryId(row.id)
    dialogRef.current?.showModal()
  }

  const closeDetail = () => {
    setApiError(null)
    setSelected(null)
    setModalView('history')
    setExpandedHistoryId(null)
  }

  const openDateFilter = () => {
    setDraftDateMode(dateMode)
    setDraftSpecificDate(specificDate || todayIso())
    setDraftStartDate(startDate || todayIso())
    setDraftEndDate(endDate || todayIso())
    document.getElementById(DATE_FILTER_MODAL_ID)?.showModal()
  }

  const applyDateFilter = () => {
    let nextStart = draftStartDate
    let nextEnd = draftEndDate
    if (
      draftDateMode === 'range' &&
      nextStart &&
      nextEnd &&
      nextStart > nextEnd
    ) {
      ;[nextStart, nextEnd] = [nextEnd, nextStart]
    }
    setDateMode(draftDateMode)
    setSpecificDate(draftSpecificDate)
    setStartDate(nextStart)
    setEndDate(nextEnd)
    document.getElementById(DATE_FILTER_MODAL_ID)?.close()
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const isRowReviewed = (row) => Boolean(row?.reviewed_at)

  const toggleRowSelected = (rowId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }

  const toggleSelectAll = (checked, pendingIds) => {
    setSelectedIds(checked ? new Set(pendingIds) : new Set())
  }

  const onBulkAudit = async () => {
    const ids = [...selectedIds]
    if (!canChangeActivityLog || ids.length === 0) return
    const ok = await confirmAction({
      title: 'অডিট নিশ্চিত করুন',
      text: `${formatBnNumber(ids.length)}টি অ্যাক্টিভিটি রিভিউড হবে। পরে বাতিল করা যাবে না।`,
      confirmText: 'অডিট করুন',
      cancelText: 'বাতিল',
    })
    if (!ok) return

    setReviewing(true)
    try {
      await reviewActivities(ids)
      setSelectedIds(new Set())
      setSelectMode(false)
      toastSuccess('অডিট সম্পন্ন হয়েছে')
      await queryClient.invalidateQueries({ queryKey: ['activities'] })
    } catch (err) {
      toastApiError(err)
    } finally {
      setReviewing(false)
    }
  }

  if (!canViewActivityLog) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-error">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  const pageData = activitiesQuery.data ?? {
    results: [],
    count: 0,
    next: null,
    previous: null,
  }
  const rows = pageData.results ?? []
  const totalCount = pageData.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const slOffset = (page - 1) * PAGE_SIZE
  const isLoading = activitiesQuery.isLoading && !activitiesQuery.data

  const pendingIds = rows
    .filter((row) => !isRowReviewed(row) && row?.id != null)
    .map((row) => row.id)
  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id))
  const somePendingSelected = pendingIds.some((id) => selectedIds.has(id))

  return (
    <section className="flex-1 min-h-0 flex flex-col bg-base-100">
      <div className="shrink-0 border-b border-base-300 px-2 py-1.5 flex flex-wrap gap-2">
        <select
          className="select select-bordered select-sm min-w-30 flex-1"
          aria-label="ধরন"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
        >
          {ACTIVITY_ENTITY_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm min-w-30 flex-1"
          aria-label="অ্যাকশন"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          {ACTIVITY_ACTION_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm min-w-30 flex-1"
          aria-label="রিভিউ"
          value={reviewedFilter}
          onChange={(e) => setReviewedFilter(e.target.value)}
        >
          {ACTIVITY_REVIEWED_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm min-w-30 flex-1"
          aria-label="সাইট"
          value={siteId || SITE_ALL}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value={SITE_ALL}>সব সাইট</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex-1 flex justify-center items-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : activitiesQuery.isError ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <ApiErrorAlert error={parseApiError(activitiesQuery.error)} />
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <table className="table table-fixed table-sm sm:table-md w-full">
              <thead className="sticky top-0 z-10 bg-base-100">
                <tr className="border-b border-base-300">
                  <th className="w-12">
                    {selectMode && canChangeActivityLog ? (
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={allPendingSelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate =
                              somePendingSelected && !allPendingSelected
                          }
                        }}
                        disabled={pendingIds.length === 0}
                        aria-label="সব নির্বাচন"
                        onChange={(e) =>
                          toggleSelectAll(e.target.checked, pendingIds)
                        }
                      />
                    ) : canChangeActivityLog ? (
                      <button
                        type="button"
                        className="font-bold"
                        onClick={() => setSelectMode(true)}
                        title="নির্বাচন মোড"
                      >
                        নং
                      </button>
                    ) : (
                      'নং'
                    )}
                  </th>
                  <th className="min-w-0">বিবরণ</th>
                  <th className="w-28 sm:w-36 text-right overflow-hidden">
                    <button
                      type="button"
                      className="font-bold max-w-full text-right whitespace-normal wrap-break-word leading-tight"
                      onClick={openDateFilter}
                    >
                      {dateFilterHeaderLabel(
                        dateMode,
                        specificDate,
                        startDate,
                        endDate,
                      )}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-center text-sm text-base-content/60 py-10"
                    >
                      কোনো অ্যাক্টিভিটি নেই।
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const biz = formatDateBn(row.business_date)
                    const entity = activityEntityLabel(row.entity_type)
                    const title = [biz, entity].filter(Boolean).join(' - ')
                    const cashNote = cashNoteFromLog(row)
                    const reviewed = isRowReviewed(row)
                    const checked = selectedIds.has(row.id)
                    return (
                      <tr
                        key={row.id}
                        className={[
                          'border-b border-base-300/70 align-top cursor-pointer hover:bg-base-200/60',
                          activityToneClass(row.action),
                          reviewed ? 'opacity-50' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => openDetail(row)}
                      >
                        <td
                          className="tabular-nums text-base-content/60"
                          onClick={(e) => {
                            if (!selectMode) return
                            e.stopPropagation()
                          }}
                        >
                          {selectMode && canChangeActivityLog ? (
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={checked}
                              disabled={reviewed}
                              aria-label={`নির্বাচন ${formatBnNumber(slOffset + index + 1)}`}
                              onChange={(e) =>
                                toggleRowSelected(row.id, e.target.checked)
                              }
                            />
                          ) : (
                            formatBnNumber(slOffset + index + 1)
                          )}
                        </td>
                        <td className="text-sm leading-snug">
                          <div>{title || '—'}</div>
                          {cashNote ? (
                            <div className="text-xs text-base-content/70 mt-0.5 truncate">
                              {cashNote.isDiff ? (
                                <ChangePair
                                  oldText={cashNote.oldText}
                                  newText={cashNote.newText}
                                />
                              ) : (
                                cashNote.text
                              )}
                            </div>
                          ) : null}
                          {row.labour_name ? (
                            <div className="text-xs text-base-content/70 mt-0.5">
                              লেবার : {row.labour_name}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-right text-xs sm:text-sm tabular-nums text-base-content/80">
                          <DateTimeStacked
                            iso={row.created_at}
                            className="items-end"
                          />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalCount > PAGE_SIZE ? (
            <div className="shrink-0 flex items-center justify-between gap-2 px-2 py-2 border-t border-base-300 bg-base-100">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1 || activitiesQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" strokeWidth={2} />
                পূর্ববর্তী
              </button>
              <span className="text-sm tabular-nums text-base-content/70">
                {formatBnNumber(page)} / {formatBnNumber(totalPages)}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages || activitiesQuery.isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                পরবর্তী
                <ChevronRight className="size-4" strokeWidth={2} />
              </button>
            </div>
          ) : null}
        </>
      )}

      {selectMode && canChangeActivityLog ? (
        <div className="fixed bottom-16 inset-x-0 z-40 px-3 pointer-events-none">
          <div className="max-w-5xl mx-auto flex justify-end gap-2 pointer-events-auto">
            <button
              type="button"
              className="btn btn-error btn-outline "
              disabled={reviewing}
              onClick={exitSelectMode}
            >
              বাতিল
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                reviewing ||
                selectedIds.size === 0 ||
                !canChangeActivityLog
              }
              onClick={onBulkAudit}
            >
              {reviewing ? (
                <span className="loading loading-spinner loading-sm" />
              ) : null}
              অডিট করুন
              {selectedIds.size > 0 ? (
                <span className="badge badge-sm badge-ghost">
                  {formatBnNumber(selectedIds.size)}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        id={DETAIL_MODAL_ID}
        className="modal"
        onClose={closeDetail}
      >
        <div className="modal-box max-w-sm h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={
                  modalView === 'record'
                    ? 'text-primary'
                    : 'text-base-content/50 hover:text-base-content'
                }
                onClick={() => setModalView('record')}
              >
                রেকর্ড
              </button>
              <button
                type="button"
                className={
                  modalView === 'history'
                    ? 'text-primary'
                    : 'text-base-content/50 hover:text-base-content'
                }
                onClick={() => {
                  setModalView('history')
                  if (selected?.id != null && expandedHistoryId == null) {
                    setExpandedHistoryId(selected.id)
                  }
                }}
              >
                হিস্ট্রি
              </button>
            </div>
          </h3>

          <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

          <div className="flex-1 min-h-0 overflow-y-auto">
            {selected && modalView === 'history' ? (
              <div className="flex flex-col gap-2 min-h-full">
                {historyQuery.isLoading ? (
                  <div className="flex flex-1 justify-center items-center py-8">
                    <span className="loading loading-spinner loading-md text-primary" />
                  </div>
                ) : historyQuery.isError ? (
                  <ApiErrorAlert error={parseApiError(historyQuery.error)} />
                ) : historyLogs.length === 0 ? (
                  <p className="text-sm text-base-content/60 text-center py-8">
                    কোনো হিস্ট্রি নেই।
                  </p>
                ) : (
                  <table className="table table-sm w-full">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="w-28 sm:w-32">তারিখ</th>
                        <th>বিবরণ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyLogs.map((log) => {
                        const open = expandedHistoryId === log.id
                        const reviewed = Boolean(log.reviewed_at)
                        const isFocus =
                          String(log.id) === String(selected.id)
                        const fields = snapshotFields(log.changes)
                        const logChanges = changeEntries(log.changes)
                        return (
                          <Fragment key={log.id}>
                            <tr
                              className={[
                                'border-b border-base-300/70 cursor-pointer hover:bg-base-200/60',
                                activityToneClass(log.action),
                                reviewed ? 'opacity-50' : '',
                                isFocus ? 'ring-1 ring-inset ring-primary/50' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={() =>
                                setExpandedHistoryId(open ? null : log.id)
                              }
                            >
                              <td className="text-xs tabular-nums text-base-content/70 align-middle whitespace-nowrap">
                                <span className="inline-flex items-start gap-1.5">
                                  {isFocus ? (
                                    <span
                                      className="mt-1 size-1.5 shrink-0 rounded-full bg-primary"
                                      title="নির্বাচিত অ্যাক্টিভিটি"
                                      aria-label="নির্বাচিত অ্যাক্টিভিটি"
                                    />
                                  ) : (
                                    <span className="mt-1 size-1.5 shrink-0" />
                                  )}
                                  <DateTimeStacked iso={log.created_at} />
                                </span>
                              </td>
                              <td className="text-sm leading-snug align-middle max-w-0">
                                <div className="truncate">
                                  <HistoryBiboron log={log} />
                                </div>
                              </td>
                            </tr>
                            {open ? (
                              <tr
                                className={[
                                  'border-b border-base-300/70',
                                  reviewed ? 'opacity-50' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                <td
                                  colSpan={2}
                                  className="bg-base-200/40 px-2 py-1.5"
                                >
                                  <div className="flex flex-col gap-0.5 text-xs leading-snug pb-1.5 mb-1.5 border-b border-base-300">
                                    <p>
                                      <span className="text-base-content/50">
                                        {shortActionLabel(log.action)}:{' '}
                                      </span>
                                      <span
                                        className={activityTextToneClass(
                                          log.action,
                                        )}
                                      >
                                        {log.actor_name || '—'}
                                      </span>
                                      <span className="text-base-content/60">
                                        {' '}
                                        ({formatDateTimeBn(log.created_at)})
                                      </span>
                                    </p>
                                    <p>
                                      <span className="text-base-content/50">
                                        অডিট:{' '}
                                      </span>
                                      {log.reviewed_at ? (
                                        <>
                                          <span>
                                            {log.reviewed_by_name || '—'}
                                          </span>
                                          <span className="text-base-content/60">
                                            {' '}
                                            (
                                            {formatDateTimeBn(log.reviewed_at)})
                                          </span>
                                        </>
                                      ) : (
                                        '—'
                                      )}
                                    </p>
                                  </div>

                                  <div className="flex flex-col gap-0.5 text-xs leading-snug">
                                    {log.labour_name ? (
                                      <div className="flex gap-1.5">
                                        <span className="w-16 shrink-0 text-base-content/60">
                                          লেবার
                                        </span>
                                        <span className="min-w-0">
                                          {log.labour_name}
                                        </span>
                                      </div>
                                    ) : null}
                                    {log.action === 'updated' ? (
                                      logChanges.length ? (
                                        logChanges.map((entry) => (
                                          <div
                                            key={entry.key}
                                            className="flex gap-1.5"
                                          >
                                            <span className="w-16 shrink-0 text-base-content/60">
                                              {fieldLabel(entry.key)}
                                            </span>
                                            <span className="min-w-0">
                                              {entry.isDiff ? (
                                                <ChangePair
                                                  oldText={formatRecordValue(
                                                    entry.key,
                                                    entry.old,
                                                  )}
                                                  newText={formatRecordValue(
                                                    entry.key,
                                                    entry.next,
                                                  )}
                                                />
                                              ) : (
                                                formatRecordValue(
                                                  entry.key,
                                                  entry.value,
                                                )
                                              )}
                                            </span>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="text-base-content/50">
                                          কোনো পরিবর্তন নেই।
                                        </p>
                                      )
                                    ) : (
                                      <>
                                        {pickRecordEntries(
                                          log.entity_type,
                                          fields,
                                        ).map(({ key, value }) => (
                                          <div
                                            key={key}
                                            className="flex gap-1.5"
                                          >
                                            <span className="w-16 shrink-0 text-base-content/60">
                                              {fieldLabel(key)}
                                            </span>
                                            <span className="min-w-0">
                                              {formatRecordValue(key, value)}
                                            </span>
                                          </div>
                                        ))}
                                        {!pickRecordEntries(
                                          log.entity_type,
                                          fields,
                                        ).length ? (
                                          <p className="text-base-content/50">
                                            কোনো বিস্তারিত নেই।
                                          </p>
                                        ) : null}
                                      </>
                                    )}
                                    {log.review_note ? (
                                      <div className="flex gap-1.5">
                                        <span className="w-16 shrink-0 text-base-content/60">
                                          নোট
                                        </span>
                                        <span className="min-w-0">
                                          {log.review_note}
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : null}

            {selected && modalView === 'record' ? (
              <div className="flex flex-col gap-2 min-h-full">
                {selected.action !== 'deleted' &&
                canLoadEntityRecord(selected) &&
                recordQuery.isLoading ? (
                  <div className="flex flex-1 justify-center items-center py-8">
                    <span className="loading loading-spinner loading-md text-primary" />
                  </div>
                ) : selected.action !== 'deleted' &&
                  canLoadEntityRecord(selected) &&
                  recordQuery.isError ? (
                  <ApiErrorAlert error={parseApiError(recordQuery.error)} />
                ) : (
                  <div className="flex flex-col gap-2 py-1">
                    {recordEntries.map(({ key, value }) => (
                      <MetaRow key={key} label={fieldLabel(key)}>
                        {formatRecordValue(key, value)}
                      </MetaRow>
                    ))}
                    {recordEntries.length === 0 ? (
                      <p className="text-sm text-base-content/50 text-center py-2">
                        কোনো রেকর্ড নেই।
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog id={DATE_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8">অ্যাকশন তারিখ</h3>

          <div className="flex flex-col gap-3">
            <div className="join join-vertical w-full">
              <button
                type="button"
                className={`btn btn-sm join-item justify-start ${
                  draftDateMode === 'day' ? 'btn-active' : 'btn-ghost'
                }`}
                onClick={() => setDraftDateMode('day')}
              >
                নির্দিষ্ট তারিখ
              </button>
              <button
                type="button"
                className={`btn btn-sm join-item justify-start ${
                  draftDateMode === 'range' ? 'btn-active' : 'btn-ghost'
                }`}
                onClick={() => setDraftDateMode('range')}
              >
                শুরু – শেষ তারিখ
              </button>
              <button
                type="button"
                className={`btn btn-sm join-item justify-start ${
                  draftDateMode === 'all' ? 'btn-active' : 'btn-ghost'
                }`}
                onClick={() => setDraftDateMode('all')}
              >
                সব তারিখ
              </button>
            </div>

            {draftDateMode === 'day' ? (
              <label className="form-control w-full">
                <span className="label-text mb-1">তারিখ</span>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={draftSpecificDate}
                  max={todayIso()}
                  onChange={(e) =>
                    setDraftSpecificDate(e.target.value || todayIso())
                  }
                />
              </label>
            ) : null}

            {draftDateMode === 'range' ? (
              <div className="flex flex-col gap-2">
                <label className="form-control w-full">
                  <span className="label-text mb-1">শুরু তারিখ</span>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={draftStartDate}
                    max={todayIso()}
                    onChange={(e) =>
                      setDraftStartDate(e.target.value || todayIso())
                    }
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text mb-1">শেষ তারিখ</span>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={draftEndDate}
                    max={todayIso()}
                    onChange={(e) =>
                      setDraftEndDate(e.target.value || todayIso())
                    }
                  />
                </label>
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-primary"
              onClick={applyDateFilter}
              disabled={
                (draftDateMode === 'day' && !draftSpecificDate) ||
                (draftDateMode === 'range' && !draftStartDate && !draftEndDate)
              }
            >
              প্রয়োগ করুন
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </section>
  )
}
