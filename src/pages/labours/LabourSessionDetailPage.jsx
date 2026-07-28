import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Lock, Trash2, X } from 'lucide-react'
import {
  fetchLabourAttendancesByLabour,
  fetchLabourDetail,
  fetchLabourPaymentsByLabour,
  fetchLabourRunningSession,
  fetchLabourSession,
} from '../../api/labours.js'
import { fetchSites } from '../../api/sites.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import {
  normalizeLabourAttendanceList,
} from '../../api/types/labourAttendance.js'
import { normalizeLabour } from '../../api/types/labour.js'
import { normalizeLabourPaymentList } from '../../api/types/labourPayment.js'
import { normalizeSiteList } from '../../api/types/site.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber, formatBnSigned } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'

const num = (v, fallback = 0) => {
  if (v == null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const formatPeriodDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
  }).format(d)
}

const formatPeriod = (session) => {
  const start = formatPeriodDate(session?.start_date)
  if (session?.is_running) return `${start} – চলমান`
  return `${start} – ${formatPeriodDate(session?.end_date)}`
}

const normalizeSession = (raw, { isRunning = false } = {}) => {
  if (!raw || typeof raw !== 'object') return null
  return {
    ...raw,
    present_days: num(raw.present_days),
    salary_earnings: num(raw.salary_earnings),
    extra_earnings: num(raw.extra_earnings),
    total_payment: num(raw.total_payment),
    total_return: num(raw.total_return),
    affected_attendance_rows: num(raw.affected_attendance_rows),
    affected_payment_rows: num(raw.affected_payment_rows),
    previous_payable: num(raw.previous_payable),
    total_earnings: num(raw.total_earnings),
    payable: num(raw.payable),
    cumulative_payable: num(raw.cumulative_payable),
    is_modified: Boolean(raw.is_modified),
    is_latest: Boolean(raw.is_latest),
    is_running: Boolean(isRunning),
  }
}

const groupPaymentsByDate = (payments) => {
  const map = new Map()
  for (const payment of payments) {
    const key = payment.date ?? ''
    const entry = map.get(key) ?? { pay: 0, return: 0 }
    if (payment.type === 'return') entry.return += num(payment.amount)
    else entry.pay += num(payment.amount)
    map.set(key, entry)
  }
  return map
}

const buildDetailRows = (attendances, payments) => {
  const attendanceByDate = new Map(
    attendances.map((row) => [row.date ?? '', row]),
  )
  const paymentByDate = groupPaymentsByDate(payments)
  const dates = new Set([
    ...attendanceByDate.keys(),
    ...paymentByDate.keys(),
  ])

  return [...dates]
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((date) => {
      const attendance = attendanceByDate.get(date) ?? null
      const payment = paymentByDate.get(date) ?? { pay: 0, return: 0 }
      return {
        date,
        attendance,
        pay: payment.pay,
        return: payment.return,
        dayEarnings:
          num(attendance?.present) * num(attendance?.salary) +
          num(attendance?.extra),
      }
    })
}

export const LabourSessionDetailPage = () => {
  const { labourId, sessionId } = useParams()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const { can } = usePermissions()
  const [showDetails, setShowDetails] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const isRunningRoute = sessionId === 'running'
  const canView = can(PERMS.viewLabour)

  const labourQuery = useQuery({
    queryKey: ['labours', labourId],
    queryFn: async () => {
      const { data } = await fetchLabourDetail(labourId)
      return normalizeLabour(data)
    },
    enabled: Boolean(canView && labourId),
  })

  const sessionQuery = useQuery({
    queryKey: ['labours', labourId, 'session-detail', sessionId],
    queryFn: async () => {
      if (isRunningRoute) {
        const { data } = await fetchLabourRunningSession(labourId)
        return data ? normalizeSession(data, { isRunning: true }) : null
      }
      const { data } = await fetchLabourSession(labourId, sessionId)
      return normalizeSession(data)
    },
    enabled: Boolean(canView && labourId && sessionId),
  })

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await fetchSites()
      return normalizeSiteList(data)
    },
    enabled: Boolean(canView && showDetails),
  })

  const session = sessionQuery.data

  const detailsEnabled = Boolean(
    showDetails && labourId && session?.start_date,
  )

  const attendanceQuery = useQuery({
    queryKey: [
      'labours',
      labourId,
      'session-detail',
      sessionId,
      'attendances',
      { site: selectedSiteId, start: session?.start_date },
    ],
    queryFn: async () => {
      const { data } = await fetchLabourAttendancesByLabour(labourId, {
        date_gte: session?.start_date,
        ...(selectedSiteId ? { site: selectedSiteId } : {}),
      })
      return normalizeLabourAttendanceList(data)
    },
    enabled: detailsEnabled,
  })

  const paymentQuery = useQuery({
    queryKey: [
      'labours',
      labourId,
      'session-detail',
      sessionId,
      'payments',
      { site: selectedSiteId, start: session?.start_date },
    ],
    queryFn: async () => {
      const { data } = await fetchLabourPaymentsByLabour(labourId, {
        date_gte: session?.start_date,
        ...(selectedSiteId ? { site: selectedSiteId } : {}),
      })
      return normalizeLabourPaymentList(data)
    },
    enabled: detailsEnabled,
  })

  const labourName = labourQuery.data?.name

  const detailRows = useMemo(
    () => buildDetailRows(attendanceQuery.data ?? [], paymentQuery.data ?? []),
    [attendanceQuery.data, paymentQuery.data],
  )

  const siteOptions = useMemo(() => {
    const usedSiteIds = new Set()

    for (const row of attendanceQuery.data ?? []) {
      if (row.site != null) usedSiteIds.add(String(row.site))
    }
    for (const row of paymentQuery.data ?? []) {
      if (row.site != null) usedSiteIds.add(String(row.site))
    }

    const siteNameById = new Map(
      (sitesQuery.data ?? []).map((site) => [String(site.id), site.name]),
    )

    return [...usedSiteIds]
      .sort((a, b) => Number(a) - Number(b))
      .map((siteId) => ({
        id: siteId,
        name: siteNameById.get(siteId) ?? `#${siteId}`,
      }))
  }, [attendanceQuery.data, paymentQuery.data, sitesQuery.data])

  const detailTotals = useMemo(
    () =>
      detailRows.reduce(
        (acc, row) => {
          acc.present += num(row.attendance?.present)
          acc.dayEarnings += row.dayEarnings
          acc.pay += row.pay
          acc.return += row.return
          return acc
        },
        { present: 0, dayEarnings: 0, pay: 0, return: 0 },
      ),
    [detailRows],
  )

  const detailsLocked = !isRunningRoute && Boolean(session?.is_modified)
  const loading =
    labourQuery.isLoading ||
    sessionQuery.isLoading ||
    (showDetails && (attendanceQuery.isLoading || paymentQuery.isLoading))

  useEffect(() => {
    setTitle?.(isRunningRoute ? 'চলমান সেশন' : 'লেবার সেশন')
    return () => setTitle?.('')
  }, [setTitle, isRunningRoute])

  useEffect(() => {
    setHeaderMenu?.(
      labourName ? (
        <span className="text-sm font-medium text-base-content/80 truncate px-1 max-w-full">
          {labourName}
        </span>
      ) : null,
    )
    return () => setHeaderMenu?.(null)
  }, [labourName, setHeaderMenu])

  if (!canView) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (labourQuery.isError) {
    return <ApiErrorAlert error={parseApiError(labourQuery.error)} />
  }

  if (sessionQuery.isError) {
    return <ApiErrorAlert error={parseApiError(sessionQuery.error)} />
  }

  if (loading && !session) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        সেশন পাওয়া যায়নি।
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {attendanceQuery.isError || paymentQuery.isError ? (
        <ApiErrorAlert
          error={parseApiError(attendanceQuery.error || paymentQuery.error)}
        />
      ) : null}

      <section className="rounded-xl border border-base-300 bg-base-100 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] border-b border-base-300">
          <div className="p-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-base-content/70">সময়কাল</span>
              <span className="font-medium whitespace-nowrap">
                {formatPeriod(session)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-base-content/70">মোট হাজিরা</span>
              <span>{formatBnNumber(session.present_days)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-base-content/70">হাজিরা আয়</span>
              <span className="text-success">
                {formatBnSigned(session.salary_earnings)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-base-content/70">অতিরিক্ত আয়</span>
              <span className="text-success">
                {formatBnSigned(session.extra_earnings)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-base-content/70">মোট পেমেন্ট</span>
              <span className="text-error">
                {formatBnSigned(-Math.abs(session.total_payment), {
                  showPlus: false,
                })}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-base-content/70">মোট রিটার্ন</span>
              <span className="text-success">
                {formatBnSigned(session.total_return)}
              </span>
            </div>
            <div className="border-t border-base-300 pt-2 flex justify-between gap-3 font-semibold">
              <span>পাওনা</span>
              <span className="text-success">
                {formatBnNumber(session.payable)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-base-content/70">আগের পাওনা</span>
              <span className="text-error">
                {formatBnSigned(-Math.abs(session.previous_payable), {
                  showPlus: false,
                })}
              </span>
            </div>
            <div className="border-t border-base-300 pt-2 flex justify-between gap-3 font-semibold">
              <span>সর্বমোট</span>
              <span className="text-success">
                {formatBnNumber(session.cumulative_payable)}
              </span>
            </div>
          </div>
        </div>

        {session.is_modified && !isRunningRoute ? (
          <div className="alert rounded-none border-0 border-t border-base-300 py-2 px-3 text-sm">
            <Lock className="size-4" strokeWidth={1.75} />
            সেশনটি পরিবর্তিত হয়েছে। ডিটেইলস ও ডিলিট বন্ধ।
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2 p-3 border-t border-base-300">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowDetails((v) => !v)}
            disabled={detailsLocked}
          >
            {showDetails ? (
              <ChevronUp className="size-4" strokeWidth={1.75} />
            ) : (
              <ChevronDown className="size-4" strokeWidth={1.75} />
            )}
            ডিটেইলস
          </button>

          {isRunningRoute ? (
            <button type="button" className="btn btn-outline btn-sm">
              <X className="size-4" strokeWidth={1.75} />
              ক্লোজ
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-error btn-sm"
              disabled={detailsLocked}
            >
              <Trash2 className="size-4" strokeWidth={1.75} />
              ডিলিট
            </button>
          )}

          <button type="button" className="btn btn-outline btn-sm">
            বেতন আপডেট
          </button>
        </div>
      </section>

      {showDetails ? (
        <section className="space-y-3">
          <div className="flex justify-end">
            <label className="form-control w-full max-w-48">
              <span className="label-text text-xs mb-1">সাইট</span>
              <select
                className="select select-bordered select-sm w-full"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
              >
                <option value="">All sites</option>
                {siteOptions.map((site) => (
                  <option key={site.id} value={String(site.id)}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {attendanceQuery.isLoading || paymentQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="border-b border-base-300">
                    <th className="w-10">নং</th>
                    <th className="w-24">তারিখ</th>
                    <th>হাজিরা</th>
                    <th className="text-right">আয়</th>
                    <th className="text-right">পেমেন্ট</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center text-sm text-base-content/60 py-10"
                      >
                        কোনো ডিটেইলস পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    detailRows.map((row, index) => (
                      <tr key={row.date} className="border-b border-base-300/70">
                        <td className="tabular-nums text-base-content/60">
                          {formatBnNumber(index + 1)}
                        </td>
                        <td className="whitespace-nowrap">
                          {formatPeriodDate(row.date)}
                        </td>
                        <td>
                          {row.attendance ? (
                            <div className="leading-tight space-y-0.5">
                              <div className="tabular-nums">
                                {formatBnNumber(row.attendance.present)} x{' '}
                                {formatBnNumber(row.attendance.salary ?? 0)}
                              </div>
                              {num(row.attendance.extra) ? (
                                <div className="text-xs text-base-content/70 tabular-nums">
                                  extra {formatBnNumber(row.attendance.extra)}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-base-content/40">—</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums">
                          {row.dayEarnings ? formatBnNumber(row.dayEarnings) : '—'}
                        </td>
                        <td className="text-right">
                          {row.pay || row.return ? (
                            <div className="space-y-0.5 leading-tight tabular-nums">
                              {row.pay ? (
                                <div className="text-error">
                                  {formatBnNumber(row.pay)}
                                </div>
                              ) : null}
                              {row.return ? (
                                <div className="text-success">
                                  {formatBnNumber(row.return)}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-base-content/40">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}

                  {detailRows.length > 0 ? (
                    <tr className="font-semibold bg-base-200/40">
                      <td colSpan={2}>মোট</td>
                      <td className="tabular-nums">
                        {formatBnNumber(detailTotals.present)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatBnNumber(detailTotals.dayEarnings)}
                      </td>
                      <td className="text-right">
                        <div className="space-y-0.5 leading-tight tabular-nums">
                          <div className="text-error">
                            {formatBnNumber(detailTotals.pay)}
                          </div>
                          <div className="text-success">
                            {formatBnNumber(detailTotals.return)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
