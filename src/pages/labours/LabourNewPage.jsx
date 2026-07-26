import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createLabour } from '../../api/labours.js'
import { fetchSites } from '../../api/sites.js'
import {
  DEFAULT_ATTENDANCE_OPTIONS,
  labourFormSchema,
  toLabourPayload,
} from '../../api/types/labour.js'
import { normalizeSiteList } from '../../api/types/site.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { formatBnNumber } from '../../utils/format.js'
import { paths } from '../../router/paths.js'

const emptyValues = {
  name: '',
  current_site: '',
  default_attendance: 1,
  default_salary: 0,
  default_fooding: 0,
  is_active: true,
}

export const LabourNewPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState(null)

  useEffect(() => {
    setTitle?.('নতুন লেবার')
    return () => setTitle?.('')
  }, [setTitle])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(labourFormSchema),
    defaultValues: emptyValues,
  })

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await fetchSites()
      return normalizeSiteList(data)
    },
  })

  const mutation = useMutation({
    mutationFn: (values) => createLabour(toLabourPayload(values)),
  })

  const saveLabour = async (values, { createAnother }) => {
    setApiError(null)
    try {
      await mutation.mutateAsync(values)
      await queryClient.invalidateQueries({ queryKey: ['labours'] })
      if (createAnother) {
        reset(emptyValues)
      } else {
        navigate(paths.labours, { replace: true })
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  }

  const onSubmit = handleSubmit((values) =>
    saveLabour(values, { createAnother: false }),
  )

  const onSaveAndCreateAnother = handleSubmit((values) =>
    saveLabour(values, { createAnother: true }),
  )

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
        <label className="form-control w-full">
          <span className="label-text mb-1">নাম</span>
          <input
            type="text"
            className={`input input-bordered w-full ${errors.name ? 'input-error' : ''}`}
            maxLength={255}
            autoFocus
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
            className={`select select-bordered w-full ${errors.current_site ? 'select-error' : ''}`}
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
            className={`select select-bordered w-full ${errors.default_attendance ? 'select-error' : ''}`}
            {...register('default_attendance')}
          >
            {DEFAULT_ATTENDANCE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {formatBnNumber(v, { maximumFractionDigits: 1 })}
              </option>
            ))}
          </select>
          {errors.default_attendance ? (
            <span className="label-text-alt text-error mt-1">
              {errors.default_attendance.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">ডিফল্ট বেতন</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className={`input input-bordered w-full ${errors.default_salary ? 'input-error' : ''}`}
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
            className={`input input-bordered w-full ${errors.default_fooding ? 'input-error' : ''}`}
            {...register('default_fooding')}
          />
          {errors.default_fooding ? (
            <span className="label-text-alt text-error mt-1">
              {errors.default_fooding.message}
            </span>
          ) : null}
        </label>

        <label className="label cursor-pointer justify-start gap-3 py-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            {...register('is_active')}
          />
          <span className="label-text">সক্রিয়</span>
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
