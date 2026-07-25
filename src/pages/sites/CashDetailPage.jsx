import { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchBillingCategories,
  fetchSiteCashDetail,
  updateSiteCash,
} from '../../api/sites.js'
import {
  CASH_CATEGORIES,
  CASH_TYPES,
  cashFormSchema,
  normalizeSiteCash,
  toSiteCashPayload,
} from '../../api/types/siteCash.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { readSelectedSite } from '../../utils/sessionSelection.js'

const toFormValues = (cash) => ({
  note: cash?.note ?? '',
  type: cash?.type ?? 'cost',
  amount: cash?.amount ?? '',
  category: cash?.category ?? '',
  billing: cash?.billing != null ? String(cash.billing) : '',
})

const formatDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

export const CashDetailPage = () => {
  const { cashId } = useParams()
  const { setTitle } = useOutletContext()
  const siteId = readSelectedSite()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [apiError, setApiError] = useState(null)

  useEffect(() => {
    setTitle?.('ক্যাশ বিবরণ')
    return () => setTitle?.('')
  }, [setTitle])

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
    defaultValues: toFormValues(null),
  })

  const type = watch('type')
  const categoryEnabled = type === 'cost'

  useEffect(() => {
    if (!categoryEnabled) setValue('category', '')
  }, [categoryEnabled, setValue])

  const detailQuery = useQuery({
    queryKey: ['sites', siteId, 'cash', cashId],
    queryFn: async () => {
      const { data } = await fetchSiteCashDetail(siteId, cashId)
      return normalizeSiteCash(data)
    },
    enabled: Boolean(siteId && cashId),
  })

  const billingQuery = useQuery({
    queryKey: ['sites', siteId, 'billing-categories'],
    queryFn: async () => {
      const { data } = await fetchBillingCategories(siteId, { is_active: true })
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(siteId),
  })

  const mutation = useMutation({
    mutationFn: (values) =>
      updateSiteCash(
        siteId,
        cashId,
        toSiteCashPayload({ ...values, date: detailQuery.data?.date }),
      ),
  })

  useEffect(() => {
    if (detailQuery.data) reset(toFormValues(detailQuery.data))
  }, [detailQuery.data, reset])

  const startEdit = () => {
    setApiError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setApiError(null)
    reset(toFormValues(detailQuery.data))
    setEditing(false)
  }

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await mutation.mutateAsync(values)
      const normalized = normalizeSiteCash(data)
      reset(toFormValues(normalized))
      await queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'cash'] })
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'daily-reports'],
      })
      setEditing(false)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  if (!siteId) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        ক্যাশ দেখতে আগে একটি সাইট নির্বাচন করুন।
      </div>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (detailQuery.isError) {
    return <ApiErrorAlert error={parseApiError(detailQuery.error)} />
  }

  const cash = detailQuery.data
  const disabled = !editing
  const fieldClass = (hasError, kind = 'input') =>
    [
      kind === 'select'
        ? 'select select-bordered w-full'
        : 'input input-bordered w-full',
      hasError ? (kind === 'select' ? 'select-error' : 'input-error') : '',
      disabled ? 'bg-base-200' : '',
    ].join(' ')

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      <form className="flex flex-col gap-3" onSubmit={onConfirm} noValidate>
        <label className="form-control w-full">
          <span className="label-text mb-1">নোট</span>
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

        <label className="form-control w-full">
          <span className="label-text mb-1">বিলিং ক্যাটাগরি</span>
          <select
            className={fieldClass(errors.billing, 'select')}
            disabled={disabled}
            {...register('billing')}
          >
            <option value="">—</option>
            {(billingQuery.data ?? []).map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-1">
          <div>
            <span className="text-base-content/60">তৈরি:</span>{' '}
            <span className="tabular-nums">
              {formatDateTime(cash?.createdAt)}
            </span>
          </div>
          <div>
            <span className="text-base-content/60">হালনাগাদ:</span>{' '}
            <span className="tabular-nums">
              {formatDateTime(cash?.updatedAt)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelEdit}
                disabled={isSubmitting || mutation.isPending}
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || mutation.isPending}
              >
                {isSubmitting || mutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'নিশ্চিত'
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={startEdit}
            >
              আপডেট
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
