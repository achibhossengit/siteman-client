import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSiteCash,
  fetchBillingCategories,
} from '../../api/sites.js'
import {
  CASH_CATEGORIES,
  CASH_TYPES,
  cashFormSchema,
  toSiteCashPayload,
} from '../../api/types/siteCash.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { paths } from '../../router/paths.js'
import {
  readSelectedDate,
  readSelectedSite,
  todayIso,
} from '../../utils/sessionSelection.js'

const emptyValues = {
  note: '',
  type: 'cost',
  amount: '',
  category: '',
  billing: '',
}

export const CashNewPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState(null)

  const siteId = readSelectedSite()
  const date = readSelectedDate() || todayIso()

  useEffect(() => {
    setTitle?.('নতুন ক্যাশ')
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
    defaultValues: emptyValues,
  })

  const type = watch('type')
  const categoryEnabled = type === 'cost'

  useEffect(() => {
    if (!categoryEnabled) setValue('category', '')
  }, [categoryEnabled, setValue])

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
      createSiteCash(siteId, toSiteCashPayload({ ...values, date })),
  })

  const saveCash = async (values, { createAnother }) => {
    setApiError(null)
    try {
      await mutation.mutateAsync(values)
      await queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'cash'] })
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'daily-reports'],
      })
      if (createAnother) {
        reset(emptyValues)
      } else {
        navigate(paths.cash, { replace: true })
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  }

  const onSubmit = handleSubmit((values) =>
    saveCash(values, { createAnother: false }),
  )

  const onSaveAndCreateAnother = handleSubmit((values) =>
    saveCash(values, { createAnother: true }),
  )

  if (!siteId) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        ক্যাশ যোগ করতে আগে একটি সাইট নির্বাচন করুন।
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
        <label className="form-control w-full">
          <span className="label-text mb-1">নোট</span>
          <input
            type="text"
            className={`input input-bordered w-full ${errors.note ? 'input-error' : ''}`}
            maxLength={255}
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
            className={`select select-bordered w-full ${errors.type ? 'select-error' : ''}`}
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
            className={`input input-bordered w-full ${errors.amount ? 'input-error' : ''}`}
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
            className={`select select-bordered w-full ${errors.category ? 'select-error' : ''} ${!categoryEnabled ? 'bg-base-200' : ''}`}
            disabled={!categoryEnabled}
            {...register('category')}
          >
            <option value="">—</option>
            {CASH_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {errors.category ? (
            <span className="label-text-alt text-error mt-1">
              {errors.category.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">বিলিং ক্যাটাগরি</span>
          <select
            className={`select select-bordered w-full ${errors.billing ? 'select-error' : ''}`}
            {...register('billing')}
          >
            <option value="">—</option>
            {(billingQuery.data ?? []).map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.billing ? (
            <span className="label-text-alt text-error mt-1">
              {errors.billing.message}
            </span>
          ) : null}
        </label>

        <div className="flex justify-between gap-2 mt-2">
          <button
            type="button"
            className="btn btn-outline btn-primary flex-1"
            disabled={isSubmitting || mutation.isPending}
            onClick={onSaveAndCreateAnother}
          >
            আরেকটি
          </button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={isSubmitting || mutation.isPending}
          >
            {isSubmitting || mutation.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'সংরক্ষণ'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
