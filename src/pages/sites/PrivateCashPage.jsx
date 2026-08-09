import { useEffect, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createPrivateSiteCash,
  deletePrivateSiteCash,
  fetchActiveBillingCategories,
  fetchPrivateSiteCash,
  fetchSiteDetail,
  updatePrivateSiteCash,
} from '../../api/sites.js'
import {
  PRIVATE_CASH_TYPES,
  privateCashFormSchema,
  privateCashTypeLabel,
  toPrivateSiteCashPayload,
} from '../../api/types/privateSiteCash.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import {
  formatBnNumber,
  formatBnSigned,
  NULL_BILLING_LABEL,
} from '../../utils/format.js'
import { confirmAction, toastSuccess } from '../../utils/feedback.js'
import { todayIso } from '../../utils/sessionSelection.js'
import { PERMS } from '../../utils/permissions.js'

const MODAL_ID = 'site_private_cash_modal'
const TYPE_FILTER_MODAL_ID = 'site_private_cash_type_filter_modal'
const BILLING_FILTER_MODAL_ID = 'site_private_cash_billing_filter_modal'

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'পরিমাণ' },
  ...PRIVATE_CASH_TYPES,
]

const filterLabel = (options, value) =>
  options.find((opt) => opt.value === value)?.label ?? options[0]?.label ?? ''

const AMOUNT_BY_TYPE = {
  bill: { sign: 1, className: 'text-success' },
  cost: { sign: -1, className: 'text-error' },
}

const formatAmount = (type, amount) => {
  const style = AMOUNT_BY_TYPE[type] ?? AMOUNT_BY_TYPE.cost
  return {
    text: formatBnSigned(style.sign * Math.abs(Number(amount) || 0)),
    className: style.className,
  }
}

const formatListDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
  }).format(d)
}

const emptyValues = {
  note: '',
  type: 'cost',
  amount: '',
  date: todayIso(),
  billing: '',
}

const toFormValues = (row) => ({
  note: row?.note ?? '',
  type: row?.type ?? 'cost',
  amount: row?.amount ?? '',
  date: row?.date ?? todayIso(),
  billing: row?.billing != null ? String(row.billing) : '',
})

const sortByDateDesc = (rows) =>
  [...(rows ?? [])].sort((a, b) => {
    const byDate = String(b.date ?? '').localeCompare(String(a.date ?? ''))
    if (byDate !== 0) return byDate
    return Number(b.id) - Number(a.id)
  })

export const PrivateCashPage = () => {
  const { siteId } = useParams()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const dialogRef = useRef(null)

  const [typeFilter, setTypeFilter] = useState('all')
  const [billingFilter, setBillingFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmReady, setConfirmReady] = useState(false)
  const [apiError, setApiError] = useState(null)

  const canView = can(PERMS.viewPrivateSiteCash)
  const canAdd = can(PERMS.addPrivateSiteCash)
  const canChange = can(PERMS.changePrivateSiteCash)
  const canDelete = can(PERMS.deletePrivateSiteCash)

  const isCreateMode = creating
  const isDetailMode = Boolean(selected) && !creating

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(privateCashFormSchema),
    defaultValues: emptyValues,
  })

  const siteQuery = useQuery({
    queryKey: ['sites', siteId],
    queryFn: async () => {
      const { data } = await fetchSiteDetail(siteId)
      return data
    },
    enabled: Boolean(canView && siteId),
  })

  const listQuery = useQuery({
    queryKey: [
      'sites',
      siteId,
      'private-cash',
      { type: typeFilter, billing: billingFilter },
    ],
    queryFn: async () => {
      const { data } = await fetchPrivateSiteCash(siteId, {
        ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
        ...(billingFilter !== 'all' && billingFilter !== 'none'
          ? { billing: billingFilter }
          : {}),
        page: 1,
        page_size: 100,
      })
      let next = sortByDateDesc(data?.results ?? [])
      if (billingFilter === 'none') {
        next = next.filter((row) => row.billing == null)
      }
      return next
    },
    enabled: Boolean(canView && siteId),
  })

  const billingQuery = useQuery({
    queryKey: ['sites', siteId, 'active-billing'],
    queryFn: async () => {
      const { data } = await fetchActiveBillingCategories(siteId)
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(canView && siteId),
  })

  const siteName = siteQuery.data?.name
  const siteInactive = siteQuery.data?.is_active === false
  const rows = listQuery.data ?? []
  const billingOptions = billingQuery.data ?? []

  const billingFilterOptions = [
    { value: 'all', label: 'বিলিং' },
    { value: 'none', label: NULL_BILLING_LABEL },
    ...billingOptions.map((b) => ({
      value: String(b.id),
      label: b.name,
    })),
  ]

  const billingFilterHeaderLabel = filterLabel(
    billingFilterOptions,
    billingFilter,
  )

  const billingName = (billingId) => {
    if (billingId == null) return NULL_BILLING_LABEL
    return (
      billingOptions.find((b) => String(b.id) === String(billingId))?.name ??
      '—'
    )
  }

  useEffect(() => {
    setTitle?.('প্রাইভেট হিসাব')
    return () => setTitle?.('')
  }, [setTitle])

  useEffect(() => {
    setHeaderMenu?.(
      siteName ? (
        <span className="text-sm font-medium text-base-content/80 truncate px-1 max-w-full">
          {siteName}
        </span>
      ) : null,
    )
    return () => setHeaderMenu?.(null)
  }, [siteName, setHeaderMenu])

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

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = toPrivateSiteCashPayload(values)
      if (isCreateMode) return createPrivateSiteCash(siteId, payload)
      return updatePrivateSiteCash(siteId, selected.id, payload)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deletePrivateSiteCash(siteId, selected.id),
  })

  const resetModalState = () => {
    setSelected(null)
    setCreating(false)
    setEditing(false)
    setApiError(null)
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
    reset({ ...emptyValues, date: todayIso() })
    dialogRef.current?.showModal()
  }

  const openDetail = (row) => {
    setApiError(null)
    setCreating(false)
    setEditing(false)
    setConfirmReady(false)
    setSelected(row)
    reset(toFormValues(row))
    dialogRef.current?.showModal()
  }

  const startEdit = () => {
    setApiError(null)
    setConfirmReady(false)
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
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'private-cash'],
      })
      if (isCreateMode) {
        closeModal()
        toastSuccess('প্রাইভেট হিসাব তৈরি হয়েছে')
      } else {
        setSelected(data)
        reset(toFormValues(data))
        setEditing(false)
        toastSuccess('প্রাইভেট হিসাব আপডেট হয়েছে')
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  const onDelete = async () => {
    const ok = await confirmAction({
      title: 'প্রাইভেট হিসাব মুছে ফেলবেন?',
      text: 'এই কাজটি ফিরিয়ে আনা যাবে না।',
      confirmText: 'ডিলিট করুন',
      danger: true,
    })
    if (!ok) return
    setApiError(null)
    try {
      await deleteMutation.mutateAsync()
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'private-cash'],
      })
      closeModal()
      toastSuccess('প্রাইভেট হিসাব ডিলিট হয়েছে')
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }

  if (!canView) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (listQuery.isLoading || siteQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (listQuery.isError) {
    return <ApiErrorAlert error={parseApiError(listQuery.error)} />
  }

  if (siteQuery.isError) {
    return <ApiErrorAlert error={parseApiError(siteQuery.error)} />
  }

  const disabled = !editing
  const busy = isSubmitting || saveMutation.isPending
  const fieldClass = (hasError, kind = 'input') =>
    [
      kind === 'select'
        ? 'select select-bordered w-full'
        : 'input input-bordered w-full',
      hasError ? (kind === 'select' ? 'select-error' : 'input-error') : '',
      disabled ? 'bg-base-200' : '',
    ].join(' ')

  return (
    <section className="relative min-h-full flex flex-col pb-20">
      <div className="overflow-x-auto">
        <table className="table table-sm sm:table-md w-full">
          <thead>
            <tr className="border-b border-base-300">
              <th className="w-12">নং</th>
              <th className="w-20">তারিখ</th>
              <th>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(BILLING_FILTER_MODAL_ID)
                      ?.showModal()
                  }
                >
                  {billingFilterHeaderLabel}
                </button>
              </th>
              <th className="w-28 sm:w-36 text-right">
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
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  কোনো প্রাইভেট হিসাব নেই।
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const { text, className } = formatAmount(row.type, row.amount)
                return (
                  <tr
                    key={row.id}
                    className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                    onClick={() => openDetail(row)}
                  >
                    <td className="tabular-nums text-base-content/60">
                      {formatBnNumber(index + 1)}
                    </td>
                    <td className="tabular-nums text-base-content/70 whitespace-nowrap">
                      {formatListDate(row.date)}
                    </td>
                    <td className="truncate max-w-28 sm:max-w-none">
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
        </table>
      </div>

      {canAdd ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-4 right-4 z-40 shadow-lg"
          aria-label="নতুন প্রাইভেট হিসাব"
          onClick={openCreate}
          disabled={siteInactive}
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>
      ) : null}

      <dialog
        ref={dialogRef}
        id={MODAL_ID}
        className="modal"
        onClose={resetModalState}
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

          <h3 className="font-semibold text-base mb-3 pr-8">
            {isCreateMode
              ? 'নতুন প্রাইভেট হিসাব'
              : selected?.note || privateCashTypeLabel(selected?.type)}
          </h3>

          <ApiErrorAlert error={apiError} className="mb-3" />

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

            <div className="flex justify-between gap-2">
              <label className="form-control w-full">
                <span className="label-text mb-1">ধরন</span>
                <select
                  className={fieldClass(errors.type, 'select')}
                  disabled={disabled}
                  {...register('type')}
                >
                  {PRIVATE_CASH_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
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
                <span className="label-text mb-1">তারিখ</span>
                <input
                  type="date"
                  className={fieldClass(errors.date)}
                  disabled={disabled}
                  {...register('date')}
                />
                {errors.date ? (
                  <span className="label-text-alt text-error mt-1">
                    {errors.date.message}
                  </span>
                ) : null}
              </label>
            </div>

            <label className="form-control w-full">
              <span className="label-text mb-1">বিলিং ক্যাটাগরি</span>
              <select
                className={fieldClass(errors.billing, 'select')}
                disabled={disabled}
                {...register('billing')}
              >
                <option value="">{NULL_BILLING_LABEL}</option>
                {billingOptions.map((opt) => (
                  <option key={opt.id} value={String(opt.id)}>
                    {opt.name}
                  </option>
                ))}
              </select>
              {errors.billing ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.billing.message}
                </span>
              ) : null}
            </label>

            {editing ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1"
                  onClick={cancelEdit}
                  disabled={busy}
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={!confirmReady || busy}
                  onClick={(e) => {
                    if (!confirmReady) return
                    return onConfirm(e)
                  }}
                >
                  {busy ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  নিশ্চিত
                </button>
              </div>
            ) : isDetailMode ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                {canDelete ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-error flex-1"
                    onClick={onDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    )}
                    ডিলিট
                  </button>
                ) : null}
                {canChange ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-primary flex-1"
                    onClick={startEdit}
                    disabled={siteInactive}
                  >
                    <Pencil className="size-4" strokeWidth={1.75} />
                    আপডেট
                  </button>
                ) : null}
              </div>
            ) : null}
          </form>
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
