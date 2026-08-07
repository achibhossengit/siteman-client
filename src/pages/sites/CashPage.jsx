import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import {
  createSiteCash,
  deleteSiteCash,
  fetchActiveBillingCategories,
  fetchSiteCashByDate,
  fetchSiteCashPendingLog,
  updateSiteCash,
} from '../../api/sites.js'
import {
  CASH_TYPES,
  cashFormSchema,
  cashTypeLabel,
  toSiteCashPayload,
} from '../../api/types/siteCash.js'
import { parseApiError, applyFieldErrors, messageForCode } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import {
  formatBnNumber,
  formatBnSigned,
  NULL_BILLING_LABEL,
} from '../../utils/format.js'
import { confirmAction, toastApiError, toastSuccess } from '../../utils/feedback.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { PERMS, hasPermissionSuffix } from '../../utils/permissions.js'
import {
  activityTextToneClass,
  activityToneClass,
  applyActivitiesToCashRows,
  snapshotFields,
} from '../../api/types/activity.js'
import { reviewActivities } from '../../api/activities.js'

const MODAL_ID = 'site_cash_modal'
const TYPE_FILTER_MODAL_ID = 'cash_type_filter_modal'
const BILLING_FILTER_MODAL_ID = 'cash_billing_filter_modal'

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
    fields.billing != null || fields.billing_id != null
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
    const entries = cashChangeEntries(log.changes).filter((e) => e.isDiff)
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

const TYPE_FILTER_OPTIONS = [{ value: 'all', label: 'পরিমাণ' }, ...CASH_TYPES]

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
      'কিছু অ্যাক্টিভিটি লগ রিভিউ করা যায়নি।'
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
    <col className="w-28 sm:w-36" />
    <col className="w-24 sm:w-32" />
  </colgroup>
)

export const CashPage = () => {
  const { date, siteId, sites } = useOutletContext()
  const queryClient = useQueryClient()
  const { can, profile } = usePermissions()
  const dialogRef = useRef(null)

  const [typeFilter, setTypeFilter] = useState('all')
  const [billingFilter, setBillingFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
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
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(cashFormSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    setTypeFilter('all')
    setBillingFilter('all')
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [siteId, date])

  useEffect(() => {
    setSelectedIds(new Set())
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

  const cashQuery = useQuery({
    queryKey: ['sites', siteId, 'cash', date],
    queryFn: async () => {
      const { data } = await fetchSiteCashByDate(siteId, date)
      return data ?? []
    },
    enabled: Boolean(canViewCash && siteId && date),
  })

  const billingQuery = useQuery({
    queryKey: ['sites', siteId, 'billing-categories', 'active'],
    queryFn: async () => {
      const { data } = await fetchActiveBillingCategories(siteId)
      return data ?? []
    },
    enabled: Boolean(canViewCash && siteId),
  })

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

  const cashActivityQueryKey = useMemo(
    () => ['sites', siteId, 'cash', date, 'pending_log'],
    [siteId, date],
  )

  const activityCashQuery = useQuery({
    queryKey: cashActivityQueryKey,
    queryFn: async () => {
      const { data } = await fetchSiteCashPendingLog(siteId, date)
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(canViewCash && canViewActivityLog && siteId && date),
  })

  /** Modal history from day pending_log (dedicated, unpaginated) — not /activities. */
  const historyLogs = useMemo(() => {
    const entityId = selected?.id
    if (entityId == null) return []
    const logs = (activityCashQuery.data ?? []).filter(
      (log) => Number(log.entity_id) === Number(entityId),
    )
    return [...logs].sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
  }, [activityCashQuery.data, selected?.id])

  const activityIdsForRow = (row) =>
    (row?.activityLogs ?? [])
      .map((log) => Number(log.id))
      .filter((id) => Number.isFinite(id))

  const liveRows = useMemo(() => {
    let rows = cashQuery.data ?? []
    if (typeFilter !== 'all') {
      rows = rows.filter((row) => row.type === typeFilter)
    }
    if (billingFilter === 'none') {
      rows = rows.filter((row) => row.billing == null)
    } else if (billingFilter !== 'all') {
      rows = rows.filter(
        (row) => String(row.billing) === String(billingFilter),
      )
    }
    return rows
  }, [cashQuery.data, typeFilter, billingFilter])

  const totals = useMemo(() => {
    let net = 0
    for (const row of liveRows) {
      const style = AMOUNT_BY_TYPE[row.type] ?? AMOUNT_BY_TYPE.cost
      net += style.sign * Math.abs(Number(row.amount) || 0)
    }
    return { net }
  }, [liveRows])

  const rows = useMemo(() => {
    let next = liveRows
    if (canViewActivityLog) {
      next = applyActivitiesToCashRows(next, activityCashQuery.data ?? [])
    }
    return next.filter((row) => {
      if (!row.fromActivitySnapshot) return true
      if (typeFilter !== 'all' && row.type !== typeFilter) return false
      if (billingFilter === 'none') return row.billing == null
      if (billingFilter !== 'all') {
        return String(row.billing) === String(billingFilter)
      }
      return true
    })
  }, [
    liveRows,
    canViewActivityLog,
    activityCashQuery.data,
    typeFilter,
    billingFilter,
  ])

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

  /** If activity API lags behind cash write, keep row tone until next real fetch. */
  const seedCashActivity = (cash, action) => {
    if (!canViewActivityLog || cash?.id == null || !action) return
    const entityId = Number(cash.id)
    if (!Number.isFinite(entityId)) return
    queryClient.setQueryData(cashActivityQueryKey, (prev) => {
      const list = Array.isArray(prev) ? prev : []
      if (
        list.some(
          (log) =>
            Number(log.entity_id) === entityId &&
            log.action === action &&
            !log.reviewed_at,
        )
      ) {
        return prev
      }
      return [
        ...list,
        {
          id: `local-${action}-${entityId}`,
          entity_id: entityId,
          entity_type: 'site_cash',
          action,
          business_date: cash.date ?? date,
          site: siteId,
          changes: {
            note: cash.note ?? '',
            type: cash.type,
            amount: cash.amount,
            billing: cash.billing ?? null,
            date: cash.date ?? date,
          },
          reviewed_at: null,
          created_at:
            cash.updated_at ?? cash.created_at ?? new Date().toISOString(),
        },
      ]
    })
  }

  const invalidateCash = async (cash, action) => {
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'cash'],
    })
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'daily-reports'],
    })
    if (!canViewActivityLog) return
    await queryClient.refetchQueries({ queryKey: cashActivityQueryKey })
    seedCashActivity(cash, action)
    await queryClient.invalidateQueries({ queryKey: ['activities', 'list'] })
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
      text: `${formatBnNumber(ids.length)}টি ক্যাশ অ্যাক্টিভিটি রিভিউড হবে। পরে বাতিল করা যাবে না।`,
      confirmText: 'অডিট করুন',
      cancelText: 'বাতিল',
    })
    if (!ok) return

    setReviewing(true)
    try {
      await reviewActivities(ids)
      exitSelectMode()
      await queryClient.refetchQueries({ queryKey: cashActivityQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['activities', 'list'] })
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
    setEditing(true)
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

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await saveMutation.mutateAsync(values)
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

  const onDelete = async () => {
    if (selected?.fromActivitySnapshot) return
    const ok = await confirmAction({
      title: 'ক্যাশ এন্ট্রি মুছে ফেলবেন?',
      text: 'এই কাজটি ফিরিয়ে আনা যাবে না।',
      confirmText: 'ডিলিট করুন',
      danger: true,
    })
    if (!ok) return
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

  const billingOptions = billingQuery.data ?? []
  const activeBillingOptions = billingOptions
  const dayBillingExtras = (() => {
    const known = new Set(billingOptions.map((b) => String(b.id)))
    const extras = []
    for (const row of cashQuery.data ?? []) {
      if (row.billing == null) continue
      const id = String(row.billing)
      if (known.has(id)) continue
      known.add(id)
      extras.push({ id: row.billing, name: '—' })
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
      : [{ id: selectedId, name: '—' }, ...activeBillingOptions]
  })()

  const billingFilterOptions = [
    { value: 'all', label: 'বিলিং' },
    { value: 'none', label: NULL_BILLING_LABEL },
    ...filterBillingOptions.map((b) => ({
      value: String(b.id),
      label: b.name,
    })),
  ]

  const billingName = (billingId) => {
    if (billingId == null) return NULL_BILLING_LABEL
    return (
      filterBillingOptions.find((b) => String(b.id) === String(billingId))
        ?.name ?? '—'
    )
  }

  const disabled = !editing
  const busy = isSubmitting || saveMutation.isPending
  const isSnapshotDetail = Boolean(selected?.fromActivitySnapshot)

  const fieldClass = (hasError, kind = 'input') =>
    [
      kind === 'select'
        ? 'select select-bordered w-full'
        : 'input input-bordered w-full',
      hasError ? (kind === 'select' ? 'select-error' : 'input-error') : '',
      disabled ? 'bg-base-200' : '',
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
              <th className="text-right">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(TYPE_FILTER_MODAL_ID)?.showModal()
                  }
                >
                  {filterLabel(TYPE_FILTER_OPTIONS, typeFilter)}
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
                  colSpan={4}
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
                          aria-label={`নির্বাচন ${formatBnNumber(index + 1)}`}
                          onChange={(e) =>
                            toggleRowSelected(row, e.target.checked)
                          }
                        />
                      ) : (
                        formatBnNumber(index + 1)
                      )}
                    </td>
                    <td className="truncate">{row.note || '—'}</td>
                    <td className="max-w-0 truncate text-base-content/80">
                      {billingName(row.billing)}
                    </td>
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
          {liveRows.length > 0 ? (
            <tfoot>
              <tr className="font-medium border-t border-base-300">
                <td />
                <td className="whitespace-nowrap">Total</td>
                <td />
                <td
                  className={`text-right tabular-nums ${
                    totals.net < 0
                      ? 'text-error'
                      : totals.net > 0
                        ? 'text-success'
                        : 'text-base-content/60'
                  }`}
                >
                  {totals.net
                    ? formatBnSigned(totals.net)
                    : formatBnSigned(0)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
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
              className="btn btn-primary shadow-lg"
              onClick={openCreate}
              disabled={!date || siteInactive}
            >
              + নতুন ক্যাশ
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
            {isCreateMode ? (
              'নতুন ক্যাশ'
            ) : canViewActivityLog && !editing ? (
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
                  হিস্ট্রি
                </button>
              </div>
            ) : (
              selected?.note || 'ক্যাশ বিবরণ'
            )}
          </h3>

          <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

          <div className="flex-1 min-h-0 overflow-y-auto">
          {modalView === 'history' && !isCreateMode && !editing ? (
            <div className="flex flex-col gap-2 min-h-full">
              {activityCashQuery.isLoading ? (
                <div className="flex flex-1 justify-center items-center py-8">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              ) : activityCashQuery.isError ? (
                <ApiErrorAlert error={parseApiError(activityCashQuery.error)} />
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
                      const fields = snapshotFields(log.changes)
                      const logChanges = cashChangeEntries(log.changes)
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
              if (!confirmReady) return
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

            <label className="form-control w-full">
              <span className="label-text mb-1">পরিমাণ</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className={fieldClass(errors.amount)}
                disabled={disabled}
                {...register('amount')}
              />
              {errors.amount ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.amount.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">ধরন</span>
              <select
                className={fieldClass(errors.type, 'select')}
                disabled={disabled}
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

            <label className="form-control w-full">
              <span className="label-text mb-1">বিলিং ক্যাটাগরি</span>
              <select
                className={fieldClass(errors.billing, 'select')}
                disabled={disabled}
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

            {editing ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                {isCreateMode ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-primary flex-1"
                    disabled={!confirmReady || busy || siteInactive}
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
                    <X className="size-4" strokeWidth={1.75} />
                    বাতিল করুন
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={!confirmReady || busy || siteInactive}
                  onClick={(e) => {
                    if (!confirmReady) return
                    return onConfirm(e)
                  }}
                >
                  {busy ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <Check className="size-4" strokeWidth={2} />
                  )}
                  {isCreateMode ? 'সংরক্ষণ' : 'নিশ্চিত করুন'}
                </button>
              </div>
            ) : isDetailMode ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                {canDeleteCash ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-error flex-1"
                    onClick={onDelete}
                    disabled={
                      isSnapshotDetail ||
                      siteInactive ||
                      deleteMutation.isPending
                    }
                  >
                    {deleteMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    )}
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
              </div>
            ) : null}
          </form>
          )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog id={TYPE_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-xs">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>
          <h3 className="font-semibold text-base">পরিমাণ ফিল্টার</h3>
          <div className="menu bg-base-100 w-full p-0 pt-3">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn btn-ghost btn-sm justify-start ${
                  typeFilter === opt.value ? 'btn-active' : ''
                }`}
                onClick={() => {
                  setTypeFilter(opt.value)
                  document.getElementById(TYPE_FILTER_MODAL_ID)?.close()
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog id={BILLING_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-xs">
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
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </section>
  )
}
