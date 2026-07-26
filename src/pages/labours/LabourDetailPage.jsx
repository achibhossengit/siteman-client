import { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLabourDetail, updateLabour } from '../../api/labours.js'
import { fetchSites } from '../../api/sites.js'
import {
  DEFAULT_ATTENDANCE_OPTIONS,
  labourFormSchema,
  labourStatusClass,
  labourStatusLabel,
  normalizeLabour,
  toLabourPayload,
} from '../../api/types/labour.js'
import { normalizeSiteList } from '../../api/types/site.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { formatBnNumber } from '../../utils/format.js'

const toFormValues = (labour) => ({
  name: labour?.name ?? '',
  current_site:
    labour?.currentSite != null ? String(labour.currentSite) : '',
  default_attendance: labour?.defaultAttendance ?? 1,
  default_salary: labour?.defaultSalary ?? 0,
  default_fooding: labour?.defaultFooding ?? 0,
  is_active: labour?.isActive ?? true,
})

const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium' }).format(d)
}

const formatDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

export const LabourDetailPage = () => {
  const { labourId } = useParams()
  const { setTitle } = useOutletContext()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [apiError, setApiError] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(labourFormSchema),
    defaultValues: toFormValues(null),
  })

  const detailQuery = useQuery({
    queryKey: ['labours', labourId],
    queryFn: async () => {
      const { data } = await fetchLabourDetail(labourId)
      return normalizeLabour(data)
    },
    enabled: Boolean(labourId),
  })

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await fetchSites()
      return normalizeSiteList(data)
    },
  })

  const labour = detailQuery.data

  useEffect(() => {
    setTitle?.(labour?.name || 'লেবার বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, labour?.name])

  useEffect(() => {
    if (labour) reset(toFormValues(labour))
  }, [labour, reset])

  const mutation = useMutation({
    mutationFn: (values) => updateLabour(labourId, toLabourPayload(values)),
  })

  const startEdit = () => {
    setApiError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setApiError(null)
    reset(toFormValues(labour))
    setEditing(false)
  }

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await mutation.mutateAsync(values)
      const normalized = normalizeLabour(data)
      reset(toFormValues(normalized))
      await queryClient.invalidateQueries({ queryKey: ['labours'] })
      setEditing(false)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

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

  if (!labour) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        লেবার পাওয়া যায়নি।
      </div>
    )
  }

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
    <div className="max-w-lg mx-auto space-y-4">
      <ApiErrorAlert error={apiError} className="mb-1" />

      <div className="flex items-center gap-2">
        <span className={`badge ${labourStatusClass(labour)}`}>
          {labourStatusLabel(labour)}
        </span>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onConfirm} noValidate>
        <label className="form-control w-full">
          <span className="label-text mb-1">নাম</span>
          <input
            type="text"
            className={fieldClass(errors.name)}
            maxLength={255}
            disabled={disabled}
            {...register('name')}
          />
          {errors.name ? (
            <span className="label-text-alt text-error mt-1">
              {errors.name.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">বর্তমান সাইট</span>
          <select
            className={fieldClass(errors.current_site, 'select')}
            disabled={disabled}
            {...register('current_site')}
          >
            <option value="">অনঅ্যাসাইনড</option>
            {(sitesQuery.data ?? []).map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">ডিফল্ট হাজিরা</span>
          <select
            className={fieldClass(errors.default_attendance, 'select')}
            disabled={disabled}
            {...register('default_attendance')}
          >
            {DEFAULT_ATTENDANCE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {formatBnNumber(v, { maximumFractionDigits: 1 })}
              </option>
            ))}
          </select>
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">ডিফল্ট বেতন</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className={fieldClass(errors.default_salary)}
            disabled={disabled}
            {...register('default_salary')}
          />
          {errors.default_salary ? (
            <span className="label-text-alt text-error mt-1">
              {errors.default_salary.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">ডিফল্ট খাবার</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className={fieldClass(errors.default_fooding)}
            disabled={disabled}
            {...register('default_fooding')}
          />
          {errors.default_fooding ? (
            <span className="label-text-alt text-error mt-1">
              {errors.default_fooding.message}
            </span>
          ) : null}
        </label>

        <label
          className={[
            'label justify-start gap-3 py-2',
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <input
            type="checkbox"
            className="toggle toggle-primary"
            disabled={disabled}
            {...register('is_active')}
          />
          <span className="label-text">সক্রিয়</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-1">
          <div>
            <span className="text-base-content/60">শেষ সেশন:</span>{' '}
            <span className="tabular-nums">
              {formatDate(labour.lastSessionDate)}
            </span>
          </div>
          <div>
            <span className="text-base-content/60">তৈরি:</span>{' '}
            <span className="tabular-nums">
              {formatDateTime(labour.createdAt)}
            </span>
          </div>
          <div>
            <span className="text-base-content/60">হালনাগাদ:</span>{' '}
            <span className="tabular-nums">
              {formatDateTime(labour.updatedAt)}
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
