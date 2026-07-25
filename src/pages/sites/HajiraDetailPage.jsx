import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { fetchBillingCategories } from '../../api/sites.js'
import {
  deleteLabourAttendance,
  deleteLabourPayment,
  fetchLabourAttendanceDetail,
  fetchLabourAttendancesByLabour,
  fetchLabourPaymentsByLabour,
  updateLabourAttendance,
} from '../../api/labours.js'
import {
  PRESENT_OPTIONS,
  attendanceFormSchema,
  normalizeLabourAttendance,
  normalizeLabourAttendanceList,
  normalizeLabourPaymentList,
  toAttendancePayload,
} from '../../api/types/hajira.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { DetailMenuButton } from '../../layouts/DetailLayout.jsx'
import { formatBnNumber, formatBnSigned } from '../../utils/format.js'
import {
  readSelectedDate,
  readSelectedSite,
  todayIso,
} from '../../utils/sessionSelection.js'
import { paths } from '../../router/paths.js'

const PAYMENT_TYPE_LABEL = {
  payment: 'পেমেন্ট',
  return: 'রিটার্ন',
}

const PAYMENT_CATEGORY_LABEL = {
  advance: 'অগ্রিম',
  fooding: 'খাবার',
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

const toFormValues = (attendance) => ({
  present: attendance?.present ?? 1,
  salary: attendance?.salary ?? 0,
  extra: attendance?.extra ?? 0,
  note: attendance?.note ?? '',
  billing: attendance?.billing != null ? String(attendance.billing) : '',
})

export const HajiraDetailPage = () => {
  const { labourId, attendanceId: attendanceIdParam } = useParams()
  const navigate = useNavigate()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const siteId = readSelectedSite()
  const date = readSelectedDate() || todayIso()
  const queryClient = useQueryClient()

  // #region agent log
  fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '64a1fe',
    },
    body: JSON.stringify({
      sessionId: '64a1fe',
      runId: 'pre-fix',
      hypothesisId: 'D',
      location: 'HajiraDetailPage.jsx:mount',
      message: 'detail page rendered',
      data: {
        labourId,
        attendanceIdParam,
        siteId,
        date,
        href: typeof window !== 'undefined' ? window.location.pathname : null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  const [editing, setEditing] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [deletingPaymentId, setDeletingPaymentId] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: toFormValues(null),
  })

  // Resolve attendance id when only labourId is in the URL.
  const listQuery = useQuery({
    queryKey: ['labours', labourId, 'attendances', { date, site: siteId }],
    queryFn: async () => {
      const { data } = await fetchLabourAttendancesByLabour(labourId, {
        date,
        site: siteId,
      })
      return normalizeLabourAttendanceList(data)
    },
    enabled: Boolean(labourId && date && !attendanceIdParam),
  })

  const attendanceId =
    attendanceIdParam ||
    listQuery.data?.[0]?.id ||
    null

  const detailQuery = useQuery({
    queryKey: ['labours', labourId, 'attendances', attendanceId],
    queryFn: async () => {
      const { data } = await fetchLabourAttendanceDetail(labourId, attendanceId)
      return normalizeLabourAttendance(data)
    },
    enabled: Boolean(labourId && attendanceId),
  })

  const paymentQuery = useQuery({
    queryKey: ['labours', labourId, 'payments', { date, site: siteId }],
    queryFn: async () => {
      const { data } = await fetchLabourPaymentsByLabour(labourId, {
        date,
        site: siteId,
      })
      return normalizeLabourPaymentList(data)
    },
    enabled: Boolean(labourId && date),
  })

  const billingQuery = useQuery({
    queryKey: ['sites', siteId, 'billing-categories'],
    queryFn: async () => {
      const { data } = await fetchBillingCategories(siteId, { is_active: true })
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(siteId),
  })

  const attendance = detailQuery.data
  const payments = paymentQuery.data ?? []
  const sealed = Boolean(attendance?.isSealed)

  const labourName =
    attendance?.labourName ||
    listQuery.data?.[0]?.labourName ||
    payments[0]?.labourName ||
    (labourId ? `#${labourId}` : '—')

  useEffect(() => {
    setTitle?.(labourName !== '—' ? labourName : 'হাজিরা বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, labourName])

  useEffect(() => {
    if (attendance) reset(toFormValues(attendance))
  }, [attendance, reset])

  const invalidateHajira = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'labour-attendances'],
    })
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'labour-payments'],
    })
    await queryClient.invalidateQueries({
      queryKey: ['labours', labourId],
    })
    await queryClient.invalidateQueries({
      queryKey: ['sites', siteId, 'daily-reports'],
    })
  }

  const updateMutation = useMutation({
    mutationFn: (values) =>
      updateLabourAttendance(
        labourId,
        attendanceId,
        toAttendancePayload({ ...values, date: attendance?.date || date }),
      ),
  })

  const deleteAttendanceMutation = useMutation({
    mutationFn: () => deleteLabourAttendance(labourId, attendanceId),
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId) => deleteLabourPayment(labourId, paymentId),
  })

  const onDeleteAttendance = useCallback(async () => {
    if (sealed || !attendanceId) return
    const ok = window.confirm('এই হাজিরা মুছে ফেলতে চান?')
    if (!ok) return
    setApiError(null)
    try {
      await deleteAttendanceMutation.mutateAsync()
      await invalidateHajira()
      navigate(paths.hajira, { replace: true })
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }, [
    sealed,
    attendanceId,
    deleteAttendanceMutation,
    invalidateHajira,
    navigate,
  ])

  useEffect(() => {
    if (!attendanceId || sealed) {
      setHeaderMenu?.(null)
      return () => setHeaderMenu?.(null)
    }
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-40 p-1 shadow-md border border-base-300"
        >
          <li>
            <button
              type="button"
              className="text-error"
              onClick={onDeleteAttendance}
              disabled={deleteAttendanceMutation.isPending}
            >
              <Trash2 className="size-4" strokeWidth={1.75} />
              মুছুন
            </button>
          </li>
        </ul>
      </DetailMenuButton>,
    )
    return () => setHeaderMenu?.(null)
  }, [
    attendanceId,
    sealed,
    setHeaderMenu,
    onDeleteAttendance,
    deleteAttendanceMutation.isPending,
  ])

  const startEdit = () => {
    if (sealed) return
    setApiError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setApiError(null)
    reset(toFormValues(attendance))
    setEditing(false)
  }

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await updateMutation.mutateAsync(values)
      const normalized = normalizeLabourAttendance(data)
      reset(toFormValues(normalized))
      await invalidateHajira()
      setEditing(false)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  const onDeletePayment = async (paymentId) => {
    const ok = window.confirm('এই পেমেন্ট মুছে ফেলতে চান?')
    if (!ok) return
    setApiError(null)
    setDeletingPaymentId(paymentId)
    try {
      await deletePaymentMutation.mutateAsync(paymentId)
      await invalidateHajira()
    } catch (err) {
      setApiError(parseApiError(err))
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const paymentTotal = useMemo(
    () =>
      payments.reduce((sum, p) => {
        const amount = Math.abs(Number(p.amount) || 0)
        return sum + (p.type === 'return' ? -amount : amount)
      }, 0),
    [payments],
  )

  if (!siteId) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        হাজিরা দেখতে আগে একটি সাইট নির্বাচন করুন।
      </div>
    )
  }

  if (!labourId) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        লেবার পাওয়া যায়নি।
      </div>
    )
  }

  const resolvingId = !attendanceIdParam && listQuery.isLoading
  const isLoading = resolvingId || detailQuery.isLoading || paymentQuery.isLoading

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  const error = listQuery.error || detailQuery.error || paymentQuery.error
  if (error) {
    return <ApiErrorAlert error={parseApiError(error)} />
  }

  if (!attendanceId || !attendance) {
    return (
      <div className="max-w-lg mx-auto space-y-4 py-6 text-center">
        <p className="text-sm text-base-content/70">
          এই তারিখে এই লেবারের কোনো হাজিরা পাওয়া যায়নি।
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(paths.hajira)}
        >
          তালিকায় ফিরে যান
        </button>
      </div>
    )
  }

  const disabled = !editing || sealed
  const fieldClass = (hasError, kind = 'input') =>
    [
      kind === 'select'
        ? 'select select-bordered w-full'
        : 'input input-bordered w-full',
      hasError ? (kind === 'select' ? 'select-error' : 'input-error') : '',
      disabled ? 'bg-base-200' : '',
    ].join(' ')

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <ApiErrorAlert error={apiError} className="mb-1" />

      {sealed ? (
        <div className="alert alert-warning text-sm py-2">
          এই রেকর্ড সিলড — পরিবর্তন বা মুছে ফেলা যাবে না।
        </div>
      ) : null}

      <section>
        <h2 className="font-semibold text-sm text-base-content/70 mb-3">
          হাজিরা
        </h2>

        <form className="flex flex-col gap-3" onSubmit={onConfirm} noValidate>
          <label className="form-control w-full">
            <span className="label-text mb-1">তারিখ</span>
            <input
              type="text"
              className="input input-bordered w-full bg-base-200"
              value={attendance.date || date}
              readOnly
              disabled
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1">হাজিরা (রোজ)</span>
            <select
              className={fieldClass(errors.present, 'select')}
              disabled={disabled}
              {...register('present')}
            >
              {PRESENT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {formatBnNumber(v, { maximumFractionDigits: 1 })}
                </option>
              ))}
            </select>
            {errors.present ? (
              <span className="label-text-alt text-error mt-1">
                {errors.present.message}
              </span>
            ) : null}
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1">বেতন</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className={fieldClass(errors.salary)}
              disabled={disabled}
              {...register('salary')}
            />
            {errors.salary ? (
              <span className="label-text-alt text-error mt-1">
                {errors.salary.message}
              </span>
            ) : null}
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1">অতিরিক্ত</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className={fieldClass(errors.extra)}
              disabled={disabled}
              {...register('extra')}
            />
            {errors.extra ? (
              <span className="label-text-alt text-error mt-1">
                {errors.extra.message}
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
              <option value="">—</option>
              {(billingQuery.data ?? []).map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1">নোট</span>
            <input
              type="text"
              className={fieldClass(errors.note)}
              maxLength={255}
              disabled={disabled}
              {...register('note')}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-1">
            <div>
              <span className="text-base-content/60">তৈরি:</span>{' '}
              <span className="tabular-nums">
                {formatDateTime(attendance.createdAt)}
              </span>
            </div>
            <div>
              <span className="text-base-content/60">হালনাগাদ:</span>{' '}
              <span className="tabular-nums">
                {formatDateTime(attendance.updatedAt)}
              </span>
            </div>
          </div>

          {!sealed ? (
            <div className="flex justify-end gap-2 mt-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={cancelEdit}
                    disabled={isSubmitting || updateMutation.isPending}
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || updateMutation.isPending}
                  >
                    {isSubmitting || updateMutation.isPending ? (
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
          ) : null}
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm text-base-content/70">পেমেন্ট</h2>
          <span className="text-sm tabular-nums font-medium">
            মোট:{' '}
            {paymentTotal < 0
              ? formatBnSigned(paymentTotal, { showPlus: false })
              : formatBnNumber(paymentTotal)}
          </span>
        </div>

        {payments.length === 0 ? (
          <p className="text-sm text-base-content/60 py-2">
            এই তারিখে কোনো পেমেন্ট নেই।
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {payments.map((p) => {
              const signed =
                p.type === 'return' ? -Math.abs(p.amount) : Math.abs(p.amount)
              return (
                <li
                  key={p.id}
                  className="rounded-box border border-base-300 bg-base-100 p-3 space-y-2"
                >
                  <div className="flex justify-between gap-2 text-sm items-start">
                    <div>
                      <div className="font-medium">
                        {PAYMENT_TYPE_LABEL[p.type] ?? p.type}
                        {p.category
                          ? ` · ${PAYMENT_CATEGORY_LABEL[p.category] ?? p.category}`
                          : ''}
                      </div>
                      {p.note ? (
                        <p className="text-sm text-base-content/70 mt-1">
                          {p.note}
                        </p>
                      ) : null}
                      <div className="text-xs text-base-content/50 tabular-nums mt-1">
                        {formatDateTime(p.createdAt)}
                        {p.isSealed ? ' · সিলড' : ''}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span
                        className={[
                          'tabular-nums font-semibold',
                          signed < 0 ? 'text-success' : '',
                        ].join(' ')}
                      >
                        {signed < 0
                          ? formatBnSigned(signed, { showPlus: false })
                          : formatBnNumber(signed)}
                      </span>
                      {!p.isSealed ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => onDeletePayment(p.id)}
                          disabled={deletingPaymentId === p.id}
                          aria-label="পেমেন্ট মুছুন"
                        >
                          {deletingPaymentId === p.id ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <Trash2 className="size-3.5" strokeWidth={1.75} />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
