import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createSiteCash,
  deleteSiteCash,
  fetchBillingCategories,
  fetchSiteCash,
  updateSiteCash,
} from '../../api/sites.js'
import {
  CASH_CATEGORIES,
  CASH_TYPES,
  cashFormSchema,
  toSiteCashPayload,
} from '../../api/types/siteCash.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { formatBnNumber, formatBnSigned } from '../../utils/format.js'
import { confirmAction, toastSuccess } from '../../utils/feedback.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { PERMS } from '../../utils/permissions.js'

const MODAL_ID = 'site_cash_modal'
const TYPE_FILTER_MODAL_ID = 'cash_type_filter_modal'
const BILLING_FILTER_MODAL_ID = 'cash_billing_filter_modal'

const TYPE_FILTER_OPTIONS = [{ value: 'all', label: 'পরিমাণ' }, ...CASH_TYPES]

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

const emptyValues = {
  note: '',
  type: 'cost',
  amount: '',
  category: '',
  billing: '',
}

const toFormValues = (cash) => ({
  note: cash?.note ?? '',
  type: cash?.type ?? 'cost',
  amount: cash?.amount ?? '',
  category: cash?.category ?? '',
  billing: cash?.billing != null ? String(cash.billing) : '',
})

const colgroup = (
  <colgroup>
    <col className="w-12" />
    <col />
    <col className="w-24 sm:w-32" />
    <col className="w-28 sm:w-36" />
  </colgroup>
)

export const CashPage = () => {
  const { date, siteId, sites } = useOutletContext()
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

  const canViewCash = can(PERMS.viewSiteCash)
  const canAddCash = can(PERMS.addSiteCash)
  const canChangeCash = can(PERMS.changeSiteCash)
  const canDeleteCash = can(PERMS.deleteSiteCash)

  const isCreateMode = creating
  const isDetailMode = Boolean(selected) && !creating

  const site = (sites ?? []).find((s) => String(s.id) === String(siteId))
  const siteInactive = site?.is_active === false

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(cashFormSchema),
    defaultValues: emptyValues,
  })

  const type = watch('type')
  const categoryEnabled = type === 'cost'

  useEffect(() => {
    if (!categoryEnabled) setValue('category', '')
  }, [categoryEnabled, setValue])

  useEffect(() => {
    setTypeFilter('all')
    setBillingFilter('all')
  }, [siteId, date])

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
    queryKey: [
      'sites',
      siteId,
      'cash',
      { date, type: typeFilter, billing: billingFilter },
    ],
    queryFn: async () => {
      const { data } = await fetchSiteCash(siteId, {
        date,
        ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
        ...(billingFilter !== 'all' && billingFilter !== 'none'
          ? { billing: billingFilter }
          : {}),
      })
      let rows = Array.isArray(data) ? data : []
      if (billingFilter === 'none') {
        rows = rows.filter((row) => row.billing == null)
      }
      return rows
    },
    enabled: Boolean(canViewCash && siteId && date),
  })

  const billingQuery = useQuery({
    queryKey: ['sites', siteId, 'billing-categories'],
    queryFn: async () => {
      const { data } = await fetchBillingCategories(siteId)
      return Array.isArray(data) ? data : []
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

  const invalidateCash = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'cash'],
    })
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'daily-reports'],
    })
  }

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
    reset(emptyValues)
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
      await invalidateCash()
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
      await saveMutation.mutateAsync(values)
      await invalidateCash()
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
    const ok = await confirmAction({
      title: 'ক্যাশ এন্ট্রি মুছে ফেলবেন?',
      text: 'এই কাজটি ফিরিয়ে আনা যাবে না।',
      confirmText: 'ডিলিট করুন',
      danger: true,
    })
    if (!ok) return
    setApiError(null)
    try {
      await deleteMutation.mutateAsync()
      await invalidateCash()
      closeModal()
      toastSuccess('ক্যাশ এন্ট্রি ডিলিট হয়েছে')
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }

  if (!canViewCash) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-error">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (!siteId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-base-content/70">
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

  const rows = cashQuery.data ?? []
  const billingOptions = billingQuery.data ?? []
  const activeBillingOptions = billingOptions.filter((b) => b.is_active !== false)
  const formBillingOptions = (() => {
    const selectedId = selected?.billing
    if (selectedId == null) return activeBillingOptions
    const hasSelected = activeBillingOptions.some(
      (b) => String(b.id) === String(selectedId),
    )
    if (hasSelected) return activeBillingOptions
    const current = billingOptions.find(
      (b) => String(b.id) === String(selectedId),
    )
    return current ? [current, ...activeBillingOptions] : activeBillingOptions
  })()

  const billingFilterOptions = [
    { value: 'all', label: 'বিলিং' },
    { value: 'none', label: 'সাইট সাধারণ' },
    ...billingOptions.map((b) => ({
      value: String(b.id),
      label: b.name,
    })),
  ]

  const billingName = (billingId) => {
    if (billingId == null) return 'সাইট সাধারণ'
    return (
      billingOptions.find((b) => String(b.id) === String(billingId))?.name ??
      '—'
    )
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
    <section className="flex-1 min-h-0 flex flex-col relative">
      <div className="shrink-0 bg-base-100 border-b border-base-300">
        <table className="table table-fixed table-xs sm:table-sm w-full text-sm">
          {colgroup}
          <thead>
            <tr>
              <th>নং</th>
              <th>বিবরণ</th>
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
            </tr>
          </thead>
        </table>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="table table-fixed table-sm sm:table-md w-full">
          {colgroup}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-sm text-base-content/60 py-10"
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
                return (
                  <tr
                    key={row.id}
                    className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                    onClick={() => openDetail(row)}
                  >
                    <td className="tabular-nums text-base-content/60">
                      {formatBnNumber(index + 1)}
                    </td>
                    <td className="truncate">{row.note || '—'}</td>
                    <td
                      className={`text-right tabular-nums font-medium ${className}`}
                    >
                      {text}
                    </td>
                    <td className="max-w-0 truncate text-base-content/80">
                      {billingName(row.billing)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {canAddCash ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-16 right-4 z-40 shadow-lg"
          aria-label="নতুন ক্যাশ"
          onClick={openCreate}
          disabled={!date || siteInactive}
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
            {isCreateMode ? 'নতুন ক্যাশ' : selected?.note || 'ক্যাশ বিবরণ'}
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
                <span className="label-text mb-1">ক্যাটাগরি</span>
                <select
                  className={fieldClass(errors.category, 'select')}
                  disabled={disabled || !categoryEnabled}
                  {...register('category')}
                >
                  <option value="">—</option>
                  {CASH_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-control w-full">
              <span className="label-text mb-1">বিলিং ক্যাটাগরি</span>
              <select
                className={fieldClass(errors.billing, 'select')}
                disabled={disabled}
                {...register('billing')}
              >
                <option value="">সাইট সাধারণ</option>
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
                    disabled={siteInactive || deleteMutation.isPending}
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
