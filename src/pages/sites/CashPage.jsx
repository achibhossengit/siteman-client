import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createSiteCash,
  deleteSiteCash,
  fetchSiteCash,
  updateSiteCash,
} from '../../api/sites.js'
import { fetchAllActivities, reviewActivities } from '../../api/activities.js'
import {
  CASH_TYPES,
  cashFormSchema,
  cashListTotalsOf,
  cashTypeLabel,
  toSiteCashPayload,
} from '../../api/types/siteCash.js'
import { parseApiError, applyFieldErrors, messageForCode } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { ListPagination } from '../../components/ListPagination.jsx'
import {
  formatBnNumber,
  formatBnSigned,
  NULL_BILLING_LABEL,
} from '../../utils/format.js'
import { confirmAction, toastApiError, toastSuccess } from '../../utils/feedback.js'
import { SHOW_BILLING, visibleFieldItems } from '../../config/features.js'
import { useBillingLookup } from '../../hooks/useBillingLookup.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { PERMS, hasPermissionSuffix } from '../../utils/permissions.js'
import {
  activityTextToneClass,
  activityToneClass,
  applyPendingActivitiesToCashRows,
  snapshotFields,
} from '../../api/types/activity.js'

const MODAL_ID = 'site_cash_modal'
const TYPE_FILTER_MODAL_ID = 'cash_type_filter_modal'
const BILLING_FILTER_MODAL_ID = 'cash_billing_filter_modal'
const PAGE_SIZE = 5

const CASH_LOG_FIELD_LABELS = {
  note: 'নোট',
  amount: 'পরিমাণ',
  type: 'ধরন',
  billing: 'বিলিং',
  billing_id: 'বিলিং',
  date: 'তারিখ',
}

const formatLogDateTimeBn = (iso) => {
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

const formatLogDateTimePartsBn = (iso) => {
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
  const { date, time } = formatLogDateTimePartsBn(iso)
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

const formatLogValue = (key, value, billingNameFn) => {
  if (value == null || value === '' || value === 'None' || value === 'null') {
    if (key === 'billing' || key === 'billing_id') return NULL_BILLING_LABEL
    return '—'
  }
  if (key === 'type') return cashTypeLabel(value)
  if (key === 'billing' || key === 'billing_id') {
    if (typeof value === 'object') {
      if (value.name) return String(value.name)
      const id = value.id ?? value.pk
      return id == null || id === '' ? NULL_BILLING_LABEL : billingNameFn(id)
    }
    return billingNameFn(value)
  }
  if (typeof value === 'boolean') return value ? 'হ্যাঁ' : 'না'
  if (typeof value === 'object') {
    if (value.name) return String(value.name)
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const cashChangeEntries = (changes) => {
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

const summarizeCashActivity = (log, billingNameFn) => {
  if (!log) return '—'
  const fields = snapshotFields(log.changes)
  const note =
    fields.note != null && fields.note !== '' ? String(fields.note) : '—'
  const type = fields.type ? cashTypeLabel(fields.type) : null
  const billing =
    SHOW_BILLING && (fields.billing != null || fields.billing_id != null)
      ? formatLogValue(
          'billing',
          fields.billing ?? fields.billing_id,
          billingNameFn,
        )
      : null
  return [note, type, billing].filter(Boolean).join(' · ')
}

/** One-line বিবরণ: update diffs with strikethrough, concatenated. */
const CashHistoryBiboron = ({ log, billingNameFn }) => {
  if (!log) return '—'
  if (log.action === 'updated') {
    const entries = visibleFieldItems(
      cashChangeEntries(log.changes).filter((e) => e.isDiff),
    )
    if (!entries.length) return '—'
    return (
      <span className="inline">
        {entries.map((entry, index) => (
          <Fragment key={entry.key}>
            {index > 0 ? (
              <span className="text-base-content/40"> · </span>
            ) : null}
            <ChangePair
              oldText={formatLogValue(entry.key, entry.old, billingNameFn)}
              newText={formatLogValue(entry.key, entry.next, billingNameFn)}
            />
          </Fragment>
        ))}
      </span>
    )
  }
  return summarizeCashActivity(log, billingNameFn)
}

const shortActionLabel = (action) => {
  if (action === 'updated') return 'আপডেট'
  if (action === 'deleted') return 'ডিলিট'
  return 'তৈরি'
}

const TYPE_DEFAULT_FIELDS = CASH_TYPES.map((t) => t.value)

const filterHeaderTitle = (title, selected, required) =>
  required.every((value) => selected.includes(value)) ? title : `${title}*`

/** Bulk review validation: attr ids + missing id details. */
const formatBulkReviewError = (parsed) => {
  const errors = Array.isArray(parsed?.errors) ? parsed.errors : []
  const idsError = errors.find((e) => e.attr === 'ids')
  const missingIds = errors
    .filter((e) => e.attr === 'missing')
    .map((e) => e.rawDetail ?? e.detail)
    .filter(Boolean)

  if (idsError || missingIds.length) {
    const main =
      idsError?.rawDetail ||
      idsError?.detail ||
      'কিছু অডিট করা যায়নি।'
    if (!missingIds.length) return String(main)
    return `${main} (missing: ${missingIds.join(', ')})`
  }

  return parsed?.message || messageForCode('error')
}

const filterLabel = (options, value) =>
  options.find((opt) => opt.value === value)?.label ?? options[0]?.label ?? ''

/** deposit = credit (+); withdrawal / cost = debit (−). Distinct color per type. */
const AMOUNT_BY_TYPE = {
  deposit: {
    sign: 1,
    className: 'text-success',
  },
  withdrawal: {
    sign: -1,
    className: 'text-warning',
  },
  cost: {
    sign: -1,
    className: 'text-error',
  },
}

const formatCashAmount = (type, amount) => {
  const style = AMOUNT_BY_TYPE[type] ?? AMOUNT_BY_TYPE.cost
  return {
    text: formatBnSigned(style.sign * Math.abs(Number(amount) || 0)),
    className: style.className,
  }
}

const sameDisplay = (a, b) => String(a ?? '') === String(b ?? '')

/** Previous (struck) + current value for update diffs in history. */
const ChangePair = ({ oldText, newText, newClassName = '' }) => {
  if (oldText == null || sameDisplay(oldText, newText)) {
    return <span className={newClassName}>{newText}</span>
  }
  return (
    <span className="inline whitespace-nowrap">
      <span className="line-through opacity-50">{oldText}</span>
      <span className={newClassName}> {newText}</span>
    </span>
  )
}

const emptyValues = {
  note: '',
  type: 'cost',
  amount: '',
  billing: '',
}

const toFormValues = (cash) => ({
  note: cash?.note ?? '',
  type: cash?.type ?? 'cost',
  amount: cash?.amount ?? '',
  billing: cash?.billing != null ? String(cash.billing) : '',
})

const colgroup = (
  <colgroup>
    <col className="w-12" />
    <col />
    {SHOW_BILLING ? <col className="w-28 sm:w-36" /> : null}
    <col className="w-24 sm:w-32" />
  </colgroup>
)

export const CashPage = () => {
  const { date, siteId, sites } = useOutletContext()
  const queryClient = useQueryClient()
  const { can, profile } = usePermissions()
  const dialogRef = useRef(null)

  const [typeFilter, setTypeFilter] = useState(() => [...TYPE_DEFAULT_FIELDS])
  const [billingFilter, setBillingFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmReady, setConfirmReady] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [reviewing, setReviewing] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [modalView, setModalView] = useState('detail') // detail | history
  const [expandedHistoryId, setExpandedHistoryId] = useState(null)

  const canViewCash = can(PERMS.viewSiteCash)
  const canAddCash = can(PERMS.addSiteCash)
  const canChangeCash = can(PERMS.changeSiteCash)
  const canDeleteCash = can(PERMS.deleteSiteCash)
  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, 'view_activitylog')
  const canChangeActivityLog =
    can(PERMS.changeActivityLog) ||
    hasPermissionSuffix(profile, 'change_activitylog')

  const isCreateMode = creating
  const isDetailMode = Boolean(selected) && !creating

  const site = (sites ?? []).find((s) => String(s.id) === String(siteId))
  const siteInactive = site?.is_active === false

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(cashFormSchema),
    defaultValues: emptyValues,
  })

  const watchedNote = watch('note')
  const watchedAmount = watch('amount')
  const noteReady = String(watchedNote ?? '').trim().length > 0
  const amountReady = (() => {
    const n = Number(watchedAmount)
    return Number.isFinite(n) && Number.isInteger(n) && n > 0
  })()
  const formReady = noteReady && amountReady

  useEffect(() => {
    setTypeFilter([...TYPE_DEFAULT_FIELDS])
    setBillingFilter('all')
    setPage(1)
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [siteId, date])

  useEffect(() => {
    setSelectedIds(new Set())
    setPage(1)
  }, [typeFilter, billingFilter])

  useEffect(() => {
    if (!editing && !creating) {
      setConfirmReady(false)
      return
    }
    let cancelled = false
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setConfirmReady(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [editing, creating])

  /** API accepts a single type; multi-select stays client-side. */
  const apiType = typeFilter.length === 1 ? typeFilter[0] : undefined
  const apiBilling =
    SHOW_BILLING && billingFilter !== 'all' && billingFilter !== 'none'
      ? Number(billingFilter)
      : undefined

  const cashQueryKey = useMemo(
    () => [
      'sites',
      siteId,
      'cash',
      {
        date,
        page,
        page_size: PAGE_SIZE,
        type: apiType ?? 'all',
        billing: SHOW_BILLING ? billingFilter : 'all',
      },
    ],
    [siteId, date, page, apiType, billingFilter],
  )

  // Single-date list (`?date=`). Date-range UI will switch to date__gte/lte later.
  const cashQuery = useQuery({
    queryKey: cashQueryKey,
    queryFn: async () => {
      const { data } = await fetchSiteCash(siteId, {
        date,
        page,
        page_size: PAGE_SIZE,
        ...(apiType ? { type: apiType } : {}),
        ...(Number.isFinite(apiBilling) ? { billing: apiBilling } : {}),
      })
      return data
    },
    enabled: Boolean(canViewCash && siteId && date),
    placeholderData: (previousData) => previousData,
  })

  const pageData = cashQuery.data ?? {
    results: [],
    count: 0,
    next: null,
    previous: null,
  }
  const pageResults = pageData.results ?? []
  const totalCount = pageData.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1)
  const slOffset = (page - 1) * PAGE_SIZE

  const {
    categories: billingOptions,
    activeCategories: activeBillingOptions,
    getBillingName,
  } = useBillingLookup(siteId, { enabled: Boolean(canViewCash && siteId) })

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = toSiteCashPayload({
        ...values,
        date: isCreateMode ? date : selected?.date,
      })
      if (isCreateMode) return createSiteCash(siteId, payload)
      return updateSiteCash(siteId, selected.id, payload)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSiteCash(siteId, selected.id),
  })

  const selectedEntityId = selected?.id ?? null

  /** Full audit log for the open cash row — fetched only on the history tab. */
  const entityHistoryQuery = useQuery({
    queryKey: [
      'activities',
      'entity',
      {
        site: siteId,
        entity_type: 'site_cash',
        entity_id: selectedEntityId,
      },
    ],
    queryFn: () =>
      fetchAllActivities({
        site: siteId,
        entity_type: 'site_cash',
        entity_id: selectedEntityId,
        page_size: 100,
      }),
    enabled: Boolean(
      canViewActivityLog &&
        modalView === 'history' &&
        !isCreateMode &&
        !editing &&
        !deleting &&
        selectedEntityId != null &&
        siteId,
    ),
  })

  const historyLogs = useMemo(() => {
    const logs = entityHistoryQuery.data ?? []
    return [...logs].sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
  }, [entityHistoryQuery.data])

  const activityIdsForRow = (row) =>
    (row?.activityLogs ?? row?.pending_activities ?? [])
      .map((log) => Number(log.id))
      .filter((id) => Number.isFinite(id))

  const liveRows = useMemo(() => {
    let rows = pageResults
    // Client-side only when the API cannot express the filter (multi-type / null billing).
    if (!apiType && typeFilter.length !== TYPE_DEFAULT_FIELDS.length) {
      rows = rows.filter((row) => typeFilter.includes(row.type))
    }
    if (SHOW_BILLING && billingFilter === 'none') {
      rows = rows.filter((row) => row.billing == null)
    }
    return rows
  }, [pageResults, typeFilter, billingFilter, apiType])

  const apiTotals = cashListTotalsOf(pageData)
  const selectedType = typeFilter.length === 1 ? typeFilter[0] : null

  const totals = useMemo(() => {
    if (!selectedType) return null
    const apiAmount = apiTotals?.[selectedType]
    const amount =
      apiAmount != null
        ? Math.abs(Number(apiAmount) || 0)
        : liveRows.reduce((sum, row) => {
            if (row.type !== selectedType) return sum
            return sum + Math.abs(Number(row.amount) || 0)
          }, 0)
    return formatCashAmount(selectedType, amount)
  }, [selectedType, apiTotals, liveRows])

  // All types ticked → no footer. A single type → that type's total.
  const showTotalsRow = Boolean(selectedType) && liveRows.length > 0

  const rows = useMemo(() => {
    if (!canViewActivityLog) return liveRows
    return applyPendingActivitiesToCashRows(liveRows)
  }, [liveRows, canViewActivityLog])

  useEffect(() => {
    if (!cashQuery.isSuccess) return
    const count = cashQuery.data?.count ?? 0
    const pages = Math.max(1, Math.ceil(count / PAGE_SIZE) || 1)
    if (page > pages) setPage(pages)
  }, [cashQuery.isSuccess, cashQuery.data?.count, page])

  const pendingIds = useMemo(() => {
    const ids = new Set()
    for (const row of rows) {
      for (const id of activityIdsForRow(row)) ids.add(id)
    }
    return [...ids]
  }, [rows])

  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id))
  const somePendingSelected = pendingIds.some((id) => selectedIds.has(id))

  /** If cash list lags behind a write, keep row tone until the next real fetch. */
  const seedCashPendingActivity = (cash, action) => {
    if (!canViewActivityLog || cash?.id == null || !action) return
    const entityId = Number(cash.id)
    if (!Number.isFinite(entityId)) return
    queryClient.setQueryData(cashQueryKey, (prev) => {
      if (!prev || !Array.isArray(prev.results)) return prev
      const list = prev.results
      const idx = list.findIndex((row) => Number(row.id) === entityId)
      if (idx === -1) return prev
      const row = list[idx]
      const pending = Array.isArray(row.pending_activities)
        ? row.pending_activities
        : []
      if (pending.some((log) => log.action === action)) return prev
      const next = [...list]
      next[idx] = {
        ...row,
        ...cash,
        pending_activities: [
          ...pending,
          { id: `local-${action}-${entityId}`, action },
        ],
      }
      return { ...prev, results: next }
    })
  }

  const invalidateCash = async (cash, action) => {
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'cash'],
    })
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'daily-reports'],
    })
    seedCashPendingActivity(cash, action)
    if (!canViewActivityLog) return
    await queryClient.invalidateQueries({ queryKey: ['activities'] })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const toggleRowSelected = (row, checked) => {
    const ids = activityIdsForRow(row)
    if (!ids.length) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? new Set(pendingIds) : new Set())
  }

  const onAcceptChanges = async () => {
    const ids = [...selectedIds]
    if (!canChangeActivityLog || ids.length === 0) return
    const ok = await confirmAction({
      title: 'অডিট নিশ্চিত করুন',
      text: `${formatBnNumber(ids.length)}টি ক্যাশ অডিট হবে। পরে বাতিল করা যাবে না।`,
      confirmText: 'অডিট করুন',
      cancelText: 'বাতিল',
    })
    if (!ok) return

    setReviewing(true)
    try {
      await reviewActivities(ids)
      exitSelectMode()
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'cash'],
      })
      await queryClient.invalidateQueries({ queryKey: ['activities'] })
      toastSuccess('অডিট সম্পন্ন হয়েছে')
    } catch (err) {
      const parsed = parseApiError(err)
      const message = formatBulkReviewError(parsed)
      toastApiError({
        message,
        errors: [{ code: null, detail: message, attr: null }],
      })
    } finally {
      setReviewing(false)
    }
  }

  const resetModalState = () => {
    setSelected(null)
    setCreating(false)
    setEditing(false)
    setDeleting(false)
    setApiError(null)
    setModalView('detail')
    setExpandedHistoryId(null)
    reset(emptyValues)
  }

  const closeModal = () => {
    dialogRef.current?.close()
  }

  const openCreate = () => {
    setApiError(null)
    setSelected(null)
    setCreating(true)
    setEditing(true)
    setDeleting(false)
    setConfirmReady(false)
    setModalView('detail')
    setExpandedHistoryId(null)
    reset(emptyValues)
    dialogRef.current?.showModal()
  }

  const openDetail = (row) => {
    setApiError(null)
    setCreating(false)
    setEditing(false)
    setDeleting(false)
    setConfirmReady(false)
    setModalView('detail')
    setExpandedHistoryId(null)
    setSelected(row)
    reset(toFormValues(row))
    dialogRef.current?.showModal()
  }

  const startEdit = () => {
    if (selected?.fromActivitySnapshot) return
    setApiError(null)
    setConfirmReady(false)
    setModalView('detail')
    setExpandedHistoryId(null)
    setDeleting(false)
    reset(toFormValues(selected))
    setEditing(true)
  }

  const startDelete = () => {
    if (selected?.fromActivitySnapshot) return
    setApiError(null)
    setModalView('detail')
    setExpandedHistoryId(null)
    setEditing(false)
    setDeleting(true)
  }

  const cancelEdit = () => {
    if (isCreateMode) {
      closeModal()
      return
    }
    setApiError(null)
    reset(toFormValues(selected))
    setEditing(false)
  }

  const cancelDelete = () => {
    setDeleting(false)
  }

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await saveMutation.mutateAsync(values)
      setPage(1)
      await invalidateCash(data, isCreateMode ? 'created' : 'updated')
      if (isCreateMode) {
        closeModal()
        toastSuccess('ক্যাশ এন্ট্রি তৈরি হয়েছে')
      } else {
        setSelected(data)
        reset(toFormValues(data))
        setEditing(false)
        toastSuccess('ক্যাশ এন্ট্রি আপডেট হয়েছে')
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  const onSaveAndCreateAnother = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await saveMutation.mutateAsync(values)
      setPage(1)
      await invalidateCash(data, 'created')
      toastSuccess('ক্যাশ এন্ট্রি তৈরি হয়েছে')
      reset(emptyValues)
      setConfirmReady(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setConfirmReady(true))
      })
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  const confirmDelete = async () => {
    if (selected?.fromActivitySnapshot || !selected) return
    setApiError(null)
    const deleted = selected
    try {
      await deleteMutation.mutateAsync()
      await invalidateCash(deleted, 'deleted')
      closeModal()
      toastSuccess('ক্যাশ এন্ট্রি ডিলিট হয়েছে')
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }

  if (!canViewCash) {
    return (
      <div className="flex-1 flex items-center justify-center text-error">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (!siteId) {
    return (
      <div className="flex-1 flex items-center justify-center text-base-content/70">
        ক্যাশ দেখতে একটি সাইট নির্বাচন করুন।
      </div>
    )
  }

  if (cashQuery.isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (cashQuery.isError) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ApiErrorAlert error={parseApiError(cashQuery.error)} />
      </div>
    )
  }

  const dayBillingExtras = (() => {
    const known = new Set(billingOptions.map((b) => String(b.id)))
    const extras = []
    for (const row of pageResults) {
      if (row.billing == null) continue
      const id = String(row.billing)
      if (known.has(id)) continue
      known.add(id)
      extras.push({ id: row.billing, name: getBillingName(row.billing) })
    }
    return extras
  })()
  const filterBillingOptions = [...billingOptions, ...dayBillingExtras]
  const formBillingOptions = (() => {
    const selectedId = selected?.billing
    if (selectedId == null) return activeBillingOptions
    const hasSelected = activeBillingOptions.some(
      (b) => String(b.id) === String(selectedId),
    )
    if (hasSelected) return activeBillingOptions
    const current = filterBillingOptions.find(
      (b) => String(b.id) === String(selectedId),
    )
    return current
      ? [current, ...activeBillingOptions]
      : [
          { id: selectedId, name: getBillingName(selectedId) },
          ...activeBillingOptions,
        ]
  })()

  const billingFilterOptions = [
    { value: 'all', label: 'বিলিং' },
    { value: 'none', label: NULL_BILLING_LABEL },
    ...filterBillingOptions.map((b) => ({
      value: String(b.id),
      label: b.name,
    })),
  ]

  const billingName = (billingId) => getBillingName(billingId)

  const disabled = !editing
  const busy = isSubmitting || saveMutation.isPending
  const amountDisabled = disabled || !noteReady
  const detailsDisabled = disabled || !amountReady
  const saveDisabled =
    !confirmReady ||
    !formReady ||
    busy ||
    siteInactive ||
    (!isCreateMode && !isDirty)
  const isSnapshotDetail = Boolean(selected?.fromActivitySnapshot)

  const fieldClass = (hasError, kind = 'input', isDisabled = disabled) =>
    [
      kind === 'select'
        ? 'select select-bordered w-full'
        : 'input input-bordered w-full',
      hasError ? (kind === 'select' ? 'select-error' : 'input-error') : '',
      isDisabled ? 'bg-base-200' : '',
    ].join(' ')

  return (
    <section className="flex-1 min-h-0 flex flex-col relative">
      <div className="bg-base-100">
        <table className="table table-sm sm:table-md w-full">
          {colgroup}
          <thead>
            <tr>
              <th>
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
                    onChange={(e) => toggleSelectAll(e.target.checked)}
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
              <th>বিবরণ</th>
              {SHOW_BILLING ? (
                <th>
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(BILLING_FILTER_MODAL_ID)
                        ?.showModal()
                    }
                  >
                    {filterLabel(billingFilterOptions, billingFilter)}
                  </button>
                </th>
              ) : null}
              <th className="text-right">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(TYPE_FILTER_MODAL_ID)?.showModal()
                  }
                >
                  {filterHeaderTitle(
                    'পরিমাণ',
                    typeFilter,
                    TYPE_DEFAULT_FIELDS,
                  )}
                </button>
              </th>
            </tr>
          </thead>
        </table>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="table table-sm sm:table-md w-full">
          {colgroup}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={SHOW_BILLING ? 4 : 3}
                  className="text-center text-base-content/60 py-10"
                >
                  এই তারিখে কোনো ক্যাশ এন্ট্রি নেই।
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const { text, className } = formatCashAmount(
                  row.type,
                  row.amount,
                )
                const isGhost = Boolean(row.fromActivitySnapshot)
                const rowActivityIds = activityIdsForRow(row)
                const selectable = rowActivityIds.length > 0
                const checked =
                  selectable &&
                  rowActivityIds.every((id) => selectedIds.has(id))
                return (
                  <tr
                    key={
                      isGhost
                        ? `activity-${row.id}`
                        : row.id
                    }
                    className={[
                      'border-b border-base-300/70 cursor-pointer hover:bg-base-200/60',
                      isGhost ? 'opacity-90' : '',
                      activityToneClass(row.activityTone),
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
                          disabled={!selectable}
                          aria-label={`নির্বাচন ${formatBnNumber(slOffset + index + 1)}`}
                          onChange={(e) =>
                            toggleRowSelected(row, e.target.checked)
                          }
                        />
                      ) : (
                        formatBnNumber(slOffset + index + 1)
                      )}
                    </td>
                    <td className="truncate">{row.note || '—'}</td>
                    {SHOW_BILLING ? (
                      <td className="max-w-0 truncate text-base-content/80">
                        {billingName(row.billing)}
                      </td>
                    ) : null}
                    <td
                      className={`text-right tabular-nums font-medium ${className}`}
                    >
                      {text}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {showTotalsRow && totals ? (
            <tfoot>
              <tr className="font-medium border-t border-base-300">
                <td />
                <td className="whitespace-nowrap">মোট</td>
                {SHOW_BILLING ? <td /> : null}
                <td className={`text-right tabular-nums ${totals.className}`}>
                  {totals.text}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
        <ListPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          isFetching={cashQuery.isFetching}
          onPageChange={setPage}
        />
        <div className="h-14" aria-hidden />
      </div>

      <div className="fixed bottom-16 inset-x-0 z-40 px-3 pointer-events-none">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-end gap-2 pointer-events-auto">
          {selectMode && canChangeActivityLog ? (
            <>
              <button
                type="button"
                className="btn btn-ghost shadow-lg bg-base-100 border border-base-300"
                disabled={reviewing}
                onClick={exitSelectMode}
              >
                বাতিল
              </button>
              <button
                type="button"
                className="btn btn-primary shadow-lg"
                disabled={reviewing || selectedIds.size === 0}
                onClick={onAcceptChanges}
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
            </>
          ) : canAddCash ? (
            <button
              type="button"
              className="btn btn-primary btn-circle btn-lg shadow-lg"
              onClick={openCreate}
              disabled={!date || siteInactive}
              aria-label="নতুন ক্যাশ"
            >
              <Plus className="size-7" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        id={MODAL_ID}
        className="modal"
        onClose={resetModalState}
      >
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
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
            {isCreateMode ? (
              'নতুন ক্যাশ'
            ) : canViewActivityLog && !editing && !deleting ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={
                    modalView === 'detail'
                      ? 'text-primary'
                      : 'text-base-content/50 hover:text-base-content'
                  }
                  onClick={() => {
                    setModalView('detail')
                    setExpandedHistoryId(null)
                  }}
                >
                  বিস্তারিত
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
                    setExpandedHistoryId(null)
                  }}
                >
                  অডিট হিস্ট্রি
                </button>
              </div>
            ) : (
              selected?.note || 'ক্যাশ বিবরণ'
            )}
          </h3>

          <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

          <div className="flex-1 min-h-0 overflow-y-auto">
          {modalView === 'history' && !isCreateMode && !editing && !deleting ? (
            <div className="flex flex-col gap-2 min-h-full">
              {entityHistoryQuery.isLoading ? (
                <div className="flex flex-1 justify-center items-center py-8">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              ) : entityHistoryQuery.isError ? (
                <ApiErrorAlert error={parseApiError(entityHistoryQuery.error)} />
              ) : historyLogs.length === 0 ? (
                <p className="text-sm text-base-content/60 text-center py-8">
                  কোনো অডিট হিস্ট্রি নেই।
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
                      const fields = snapshotFields(log.changes)
                      const logChanges = visibleFieldItems(
                        cashChangeEntries(log.changes),
                      )
                      return (
                        <Fragment key={log.id}>
                          <tr
                            className={[
                              'border-b border-base-300/70 cursor-pointer hover:bg-base-200/60',
                              activityToneClass(log.action),
                              reviewed ? 'opacity-50' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() =>
                              setExpandedHistoryId(open ? null : log.id)
                            }
                          >
                            <td className="text-xs tabular-nums text-base-content/70 align-middle whitespace-nowrap">
                              <DateTimeStacked iso={log.created_at} />
                            </td>
                            <td className="text-sm leading-snug align-middle max-w-0">
                              <div className="truncate">
                                <CashHistoryBiboron
                                  log={log}
                                  billingNameFn={billingName}
                                />
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
                                      ({formatLogDateTimeBn(log.created_at)})
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
                                          {formatLogDateTimeBn(log.reviewed_at)}
                                          )
                                        </span>
                                      </>
                                    ) : (
                                      '—'
                                    )}
                                  </p>
                                </div>

                                <div className="flex flex-col gap-0.5 text-xs leading-snug">
                                  {log.action === 'updated' ? (
                                    logChanges.length ? (
                                      logChanges.map((entry) => (
                                        <div
                                          key={entry.key}
                                          className="flex gap-1.5"
                                        >
                                          <span className="w-16 shrink-0 text-base-content/60">
                                            {CASH_LOG_FIELD_LABELS[entry.key] ??
                                              entry.key}
                                          </span>
                                          <span className="min-w-0">
                                            {entry.isDiff ? (
                                              <ChangePair
                                                oldText={formatLogValue(
                                                  entry.key,
                                                  entry.old,
                                                  billingName,
                                                )}
                                                newText={formatLogValue(
                                                  entry.key,
                                                  entry.next,
                                                  billingName,
                                                )}
                                              />
                                            ) : (
                                              formatLogValue(
                                                entry.key,
                                                entry.value,
                                                billingName,
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
                                      <div className="flex gap-1.5">
                                        <span className="w-16 shrink-0 text-base-content/60">
                                          নোট
                                        </span>
                                        <span>
                                          {fields.note != null &&
                                          fields.note !== ''
                                            ? String(fields.note)
                                            : '—'}
                                        </span>
                                      </div>
                                      <div className="flex gap-1.5">
                                        <span className="w-16 shrink-0 text-base-content/60">
                                          পরিমাণ
                                        </span>
                                        <span>
                                          {
                                            formatCashAmount(
                                              fields.type,
                                              fields.amount,
                                            ).text
                                          }
                                        </span>
                                      </div>
                                      <div className="flex gap-1.5">
                                        <span className="w-16 shrink-0 text-base-content/60">
                                          ধরন
                                        </span>
                                        <span>
                                          {cashTypeLabel(fields.type)}
                                        </span>
                                      </div>
                                      {SHOW_BILLING ? (
                                      <div className="flex gap-1.5">
                                        <span className="w-16 shrink-0 text-base-content/60">
                                          বিলিং
                                        </span>
                                        <span>
                                          {formatLogValue(
                                            'billing',
                                            fields.billing ?? fields.billing_id,
                                            billingName,
                                          )}
                                        </span>
                                      </div>
                                      ) : null}
                                    </>
                                  )}
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
          ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (saveDisabled) return
              return onConfirm(e)
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">বিবরণ</span>
              <input
                type="text"
                className={fieldClass(errors.note)}
                maxLength={255}
                disabled={disabled}
                {...register('note')}
              />
              {errors.note ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.note.message}
                </span>
              ) : null}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="form-control w-full min-w-0">
                <span className="label-text mb-1">পরিমাণ</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  className={fieldClass(errors.amount, 'input', amountDisabled)}
                  disabled={amountDisabled}
                  {...register('amount')}
                />
                {errors.amount ? (
                  <span className="label-text-alt text-error mt-1">
                    {errors.amount.message}
                  </span>
                ) : null}
              </label>

              <label className="form-control w-full min-w-0">
                <span className="label-text mb-1">ধরন</span>
                <select
                  className={fieldClass(errors.type, 'select', detailsDisabled)}
                  disabled={detailsDisabled}
                  {...register('type')}
                >
                  {CASH_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {errors.type ? (
                  <span className="label-text-alt text-error mt-1">
                    {errors.type.message}
                  </span>
                ) : null}
              </label>
            </div>

            {SHOW_BILLING ? (
            <label className="form-control w-full">
              <span className="label-text mb-1">বিলিং ক্যাটাগরি</span>
              <select
                className={fieldClass(errors.billing, 'select', detailsDisabled)}
                disabled={detailsDisabled}
                {...register('billing')}
              >
                  <option value="">{NULL_BILLING_LABEL}</option>
                  {formBillingOptions.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name}
                    </option>
                  ))}
                </select>
            </label>
            ) : (
              <input type="hidden" {...register('billing')} />
            )}

            {editing ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                {isCreateMode ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-primary flex-1"
                    disabled={saveDisabled}
                    onClick={onSaveAndCreateAnother}
                  >
                    {busy ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      'আরেকটি'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost flex-1"
                    onClick={cancelEdit}
                    disabled={busy}
                  >
                    বাতিল
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={saveDisabled}
                  onClick={(e) => {
                    if (saveDisabled) return
                    return onConfirm(e)
                  }}
                >
                  {busy ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  {isCreateMode ? 'সংরক্ষণ' : 'আপডেট নিশ্চিত'}
                </button>
              </div>
            ) : isDetailMode ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                {deleting ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost flex-1"
                      onClick={cancelDelete}
                      disabled={deleteMutation.isPending}
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      className="btn btn-error flex-1"
                      onClick={confirmDelete}
                      disabled={
                        isSnapshotDetail ||
                        siteInactive ||
                        deleteMutation.isPending
                      }
                    >
                      {deleteMutation.isPending ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : null}
                      ডিলিট নিশ্চিত
                    </button>
                  </>
                ) : (
                  <>
                    {canDeleteCash ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-error flex-1"
                        onClick={startDelete}
                        disabled={isSnapshotDetail || siteInactive}
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} />
                        ডিলিট
                      </button>
                    ) : null}
                    {canChangeCash ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-primary flex-1"
                        onClick={startEdit}
                        disabled={isSnapshotDetail || siteInactive}
                      >
                        <Pencil className="size-4" strokeWidth={1.75} />
                        আপডেট
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </form>
          )}
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>

      <dialog id={TYPE_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8 shrink-0">পরিমাণ</h3>
          <div className="flex flex-col gap-3 pt-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {CASH_TYPES.map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={typeFilter.includes(opt.value)}
                    onChange={() => {
                      setTypeFilter((prev) => {
                        if (prev.includes(opt.value)) {
                          if (prev.length === 1) return prev
                          return prev.filter((value) => value !== opt.value)
                        }
                        return [...prev, opt.value]
                      })
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>

      {SHOW_BILLING ? (
      <dialog id={BILLING_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-xs max-h-[min(32rem,85vh)] overflow-y-auto">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>
          <h3 className="font-semibold text-base">বিলিং ফিল্টার</h3>
          <div className="menu bg-base-100 w-full p-0 pt-3 max-h-72 overflow-y-auto">
            {billingFilterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn btn-ghost btn-sm justify-start ${
                  billingFilter === opt.value ? 'btn-active' : ''
                }`}
                onClick={() => {
                  setBillingFilter(opt.value)
                  document.getElementById(BILLING_FILTER_MODAL_ID)?.close()
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>
      ) : null}
    </section>
  )
}
