import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import {
  deleteLabour,
  fetchLabourDetail,
  updateLabour,
} from '../../api/labours.js'
import { fetchSites } from '../../api/sites.js'
import {
  DEFAULT_ATTENDANCE_OPTIONS,
  labourFormSchema,
  toLabourPayload,
} from '../../api/types/labour.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { DetailMenuButton } from '../../layouts/DetailLayout.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

const toFormValues = (labour) => ({
  name: labour?.name ?? '',
  current_site: labour?.current_site != null ? String(labour.current_site) : '',
  default_attendance: labour?.default_attendance ?? 1,
  default_salary: labour?.default_salary ?? 0,
  default_fooding: labour?.default_fooding ?? 0,
  is_active: labour?.is_active ?? true,
})

export const LabourDetailPage = () => {
  const { labourId } = useParams()
  const navigate = useNavigate()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [editing, setEditing] = useState(false)
  const [confirmReady, setConfirmReady] = useState(false)
  const [apiError, setApiError] = useState(null)

  const canViewLabour = can(PERMS.viewLabour)
  const canChangeLabour = can(PERMS.changeLabour)
  const canDeleteLabour = can(PERMS.deleteLabour)

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
  
  setTitle?.('লেবার বিবরণ')
  
  const detailQuery = useQuery({
    queryKey: ['labours', labourId],
    queryFn: async () => {
      const { data } = await fetchLabourDetail(labourId)
      return data
    },
    enabled: Boolean(canViewLabour && labourId),
  })

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await fetchSites()
      return Array.isArray(data) ? data : []
    },
    enabled: canViewLabour,
  })

  const labour = detailQuery.data
  

  useEffect(() => {
    if (!labourId) {
      setHeaderMenu?.(null)
      return () => setHeaderMenu?.(null)
    }
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-48 p-1 shadow-md border border-base-300"
        >
          <li>
            <button
              type="button"
              onClick={() => navigate(paths.labourSessions(labourId))}
            >
              সেশনসমূহ
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => navigate(paths.labourRunningSession(labourId))}
            >
              চলমান সেশন
            </button>
          </li>
        </ul>
      </DetailMenuButton>,
    )
    return () => setHeaderMenu?.(null)
  }, [labourId, navigate, setHeaderMenu])

  useEffect(() => {
    if (labour) reset(toFormValues(labour))
  }, [labour, reset])

  // Prevent ghost-submit: Update and Confirm share the same spot.
  useEffect(() => {
    if (!editing) {
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
  }, [editing])

  const mutation = useMutation({
    mutationFn: (values) => updateLabour(labourId, toLabourPayload(values)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteLabour(labourId),
  })

  const startEdit = () => {
    setApiError(null)
    setConfirmReady(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    setApiError(null)
    reset(toFormValues(labour))
    setEditing(false)
  }

  const onDelete = async () => {
    const ok = window.confirm('এই লেবার মুছে ফেলতে চান?')
    if (!ok) return
    setApiError(null)
    try {
      await deleteMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: ['labours'] })
      navigate(paths.labours, { replace: true })
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await mutation.mutateAsync(values)
      reset(toFormValues(data))
      await queryClient.invalidateQueries({ queryKey: ['labours'] })
      setEditing(false)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  if (!canViewLabour) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
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

  if (!labour) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        লেবার পাওয়া যায়নি।
      </div>
    )
  }

  const disabled = !editing
  const busy = isSubmitting || mutation.isPending
  const showActions = canChangeLabour || canDeleteLabour
  const fieldClass = (hasError, kind = 'input') =>
    [
      kind === 'select'
        ? 'select select-bordered w-full'
        : 'input input-bordered w-full',
      hasError ? (kind === 'select' ? 'select-error' : 'input-error') : '',
      disabled ? 'bg-base-100' : '',
    ].join(' ')

  return (
    <div className="max-w-lg mx-auto">
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
            <option value="">-------</option>
            {(sitesQuery.data ?? []).map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="label cursor-pointer justify-start gap-3 py-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            disabled={disabled}
            {...register('is_active')}
          />
          <span className="label-text">সক্রিয়</span>
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
          <span className="label-text mb-1">ডিফল্ট খোরাকি</span>
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

        {showActions ? (
          editing ? (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={cancelEdit}
                disabled={busy}
              >
                <X className="size-4" strokeWidth={1.75} />
                বাতিল করুন
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
                ) : (
                  <Check className="size-4" strokeWidth={2} />
                )}
                নিশ্চিত করুন
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-2">
              {canDeleteLabour ? (
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
              {canChangeLabour ? (
                <button
                  type="button"
                  className="btn btn-outline btn-primary flex-1"
                  onClick={startEdit}
                >
                  <Pencil className="size-4" strokeWidth={1.75} />
                  আপডেট
                </button>
              ) : null}
            </div>
          )
        ) : null}
      </form>
    </div>
  )
}
