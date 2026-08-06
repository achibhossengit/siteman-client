import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { fetchActivities, reviewActivitiesBulk, reviewActivity } from '../../api/activities.js'
import {
  ACTIVITY_ACTION_FILTER_OPTIONS,
  ACTIVITY_ENTITY_FILTER_OPTIONS,
  ACTIVITY_REVIEWED_FILTER_OPTIONS,
  activityActionLabel,
  activityEntityLabel,
  activityTextToneClass,
  activityToneClass,
} from '../../api/types/activity.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { paths } from '../../router/paths.js'
import { confirmAction, toastApiError, toastSuccess } from '../../utils/feedback.js'
import { formatBnNumber } from '../../utils/format.js'
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
  extra: 'বাড়তি',
  note: 'নোট',
  billing: 'বিলিং',
  billing_id: 'বিলিং',
  amount: 'পরিমাণ',
  type: 'ধরন',
  category: 'ক্যাটাগরি',
  date: 'তারিখ',
  name: 'নাম',
  phone: 'ফোন',
  active: 'সক্রিয়',
  closed: 'বন্ধ',
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

/** Hajira / cash (or private cash) deep link for a log's business date + site. */
const entityPageHref = (log, fallbackSiteId) => {
  const site = log?.site ?? fallbackSiteId
  const date = log?.business_date
  if (!site || !date) return null
  const q = new URLSearchParams({
    site: String(site),
    date: String(date),
  })
  if (
    log.entity_type === 'attendance' ||
    log.entity_type === 'labour_payment'
  ) {
    return `${paths.hajira}?${q}`
  }
  if (log.entity_type === 'site_cash') {
    return `${paths.cash}?${q}`
  }
  if (log.entity_type === 'private_site_cash') {
    return `${paths.sitePrivateCash(site)}?date=${encodeURIComponent(date)}`
  }
  return null
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
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="line-through opacity-50">{oldText}</span>
      <span>{newText}</span>
    </span>
  )
}

const MetaRow = ({ label, children }) => (
  <div className="flex gap-3 text-sm">
    <span className="w-28 shrink-0 text-base-content/60">{label}</span>
    <span className="min-w-0 wrap-break-word">{children}</span>
  </div>
)

const MetaCell = ({ label, children }) => (
  <div className="min-w-0 flex flex-col gap-0.5">
    <span className="text-[10px] tracking-wide text-base-content/50 leading-none">
      {label}
    </span>
    <div className="text-sm leading-snug wrap-break-word">{children}</div>
  </div>
)

const actorActionLabel = (action) => {
  if (action === 'updated') return 'আপডেট করেছেন'
  if (action === 'deleted') return 'ডিলিট করেছেন'
  return 'তৈরি করেছেন'
}

const actionTimeLabel = (action) => {
  if (action === 'updated') return 'আপডেটের সময়'
  if (action === 'deleted') return 'ডিলিটের সময়'
  return 'তৈরির সময়'
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
  const { profile: authProfile } = useAuth()
  const queryClient = useQueryClient()
  const dialogRef = useRef(null)
  const skipPageReset = useRef(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const { can, profile } = usePermissions()

  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, 'view_activitylog')
  const canChangeActivityLog =
    can(PERMS.changeActivityLog) ||
    hasPermissionSuffix(profile, 'change_activitylog')

  const sites = useMemo(() => {
    const list = Array.isArray(authProfile?.sites) ? authProfile.sites : []
    return list.filter((s) => s && s.id != null && s.closed !== false)
  }, [authProfile])

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
        paginate: true,
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

  const reviewMutation = useMutation({
    mutationFn: (id) => reviewActivity(id),
    onSuccess: async () => {
      toastSuccess('রিভিউ সম্পন্ন হয়েছে')
      setApiError(null)
      dialogRef.current?.close()
      setSelected(null)
      await queryClient.invalidateQueries({ queryKey: ['activities'] })
    },
    onError: (error) => {
      setApiError(parseApiError(error))
      toastApiError(error)
    },
  })

  const openDetail = (row) => {
    setApiError(null)
    setSelected(row)
    dialogRef.current?.showModal()
  }

  const closeDetail = () => {
    setApiError(null)
    setSelected(null)
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
      await reviewActivitiesBulk(ids)
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

  const isReviewed = Boolean(selected?.reviewed_at)
  const changes = changeEntries(selected?.changes)
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
                    const pageHref = entityPageHref(row, siteId)
                    const labourId = row.labour
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
                          {pageHref ? (
                            <Link
                              to={pageHref}
                              className="link link-hover text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {title || '—'}
                            </Link>
                          ) : (
                            <div>{title || '—'}</div>
                          )}
                          {row.labour_name && labourId != null ? (
                            <div className="text-xs mt-0.5">
                              লেবার :{' '}
                              <Link
                                to={paths.labourDetail(labourId)}
                                className="link link-hover text-primary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {row.labour_name}
                              </Link>
                            </div>
                          ) : row.labour_name ? (
                            <div className="text-xs text-base-content/70 mt-0.5">
                              লেবার : {row.labour_name}
                            </div>
                          ) : null}
                        </td>
                        <td className="text-right text-xs sm:text-sm tabular-nums text-base-content/80 whitespace-normal wrap-break-word leading-tight">
                          {formatDateTimeBn(row.created_at)}
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

          <h3
            className={[
              'font-semibold text-base pr-8 pb-3 border-b border-base-300',
              activityTextToneClass(selected?.action),
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {activityEntityLabel(selected?.entity_type)} ·{' '}
            {activityActionLabel(selected?.action)}
          </h3>

          <ApiErrorAlert error={apiError} className="mt-3" />

          {selected ? (
            <div className="flex flex-col">
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 py-3 border-b border-base-300">
                <MetaCell label={actorActionLabel(selected.action)}>
                  {selected.actor_name || '—'}
                </MetaCell>
                <MetaCell label={actionTimeLabel(selected.action)}>
                  {formatDateTimeBn(selected.created_at)}
                </MetaCell>
                <MetaCell label="অডিট করেছেন">
                  {isReviewed ? selected.reviewed_by_name || '—' : '—'}
                </MetaCell>
                <MetaCell label="অডিট সময়">
                  {isReviewed
                    ? formatDateTimeBn(selected.reviewed_at)
                    : '—'}
                </MetaCell>
              </div>

              <div className="flex flex-col gap-2 py-3">
                {selected.labour_name ? (
                  <MetaRow label="লেবার">
                    {selected.labour != null ? (
                      <Link
                        to={paths.labourDetail(selected.labour)}
                        className="link link-hover text-primary"
                      >
                        {selected.labour_name}
                      </Link>
                    ) : (
                      selected.labour_name
                    )}
                  </MetaRow>
                ) : null}
                {selected.business_date ? (
                  <MetaRow label="তারিখ">
                    {formatDateBn(selected.business_date) ?? '—'}
                  </MetaRow>
                ) : null}
                {changes.map((entry) => (
                  <MetaRow key={entry.key} label={fieldLabel(entry.key)}>
                    {entry.isDiff ? (
                      <ChangePair
                        oldText={formatChangeValue(entry.old)}
                        newText={formatChangeValue(entry.next)}
                      />
                    ) : (
                      formatChangeValue(entry.value)
                    )}
                  </MetaRow>
                ))}
                {selected.review_note ? (
                  <MetaRow label="নোট">{selected.review_note}</MetaRow>
                ) : null}
                {!selected.labour_name &&
                !selected.business_date &&
                changes.length === 0 &&
                !selected.review_note ? (
                  <p className="text-sm text-base-content/50 text-center py-2">
                    কোনো বিস্তারিত নেই।
                  </p>
                ) : null}
              </div>

              <div className="flex gap-2 pt-1">
                {!isReviewed && canChangeActivityLog ? (
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate(selected.id)}
                  >
                    {reviewMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : null}
                    অডিট করুন
                  </button>
                ) : null}
                {(() => {
                  const href = entityPageHref(selected, siteId)
                  if (!href) return null
                  return (
                    <Link
                      to={href}
                      className="btn btn-outline flex-1"
                      onClick={() => dialogRef.current?.close()}
                    >
                      রেকর্ডটি দেখুন
                    </Link>
                  )
                })()}
              </div>
            </div>
          ) : null}
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
