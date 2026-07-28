import { useEffect, useMemo } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchLabourDetail,
  fetchLabourRunningSession,
  fetchLabourSessions,
} from '../../api/labours.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

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
  const start = formatPeriodDate(session.start_date)
  if (session.is_running) return `${start} – চলমান`
  return `${start} – ${formatPeriodDate(session.end_date)}`
}

export const LabourSessionsPage = () => {
  const { labourId } = useParams()
  const navigate = useNavigate()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const { can } = usePermissions()
  const canView = can(PERMS.viewLabour)

  const labourQuery = useQuery({
    queryKey: ['labours', labourId],
    queryFn: async () => {
      const { data } = await fetchLabourDetail(labourId)
      return data
    },
    enabled: Boolean(canView && labourId),
  })

  const sessionsQuery = useQuery({
    queryKey: ['labours', labourId, 'sessions'],
    queryFn: async () => {
      const { data } = await fetchLabourSessions(labourId)
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(canView && labourId),
  })

  const runningQuery = useQuery({
    queryKey: ['labours', labourId, 'sessions', 'running'],
    queryFn: async () => {
      const { data } = await fetchLabourRunningSession(labourId)
      return data ?? null
    },
    enabled: Boolean(canView && labourId),
  })

  const sessions = useMemo(() => {
    const sealed = sessionsQuery.data ?? []
    const running = runningQuery.data
    if (!running?.start_date) return sealed
    return [{ ...running, is_running: true }, ...sealed]
  }, [sessionsQuery.data, runningQuery.data])

  const labourName = labourQuery.data?.name
  const loading =
    labourQuery.isLoading || sessionsQuery.isLoading || runningQuery.isLoading

  useEffect(() => {
    setTitle?.('লেবার সেশন')
    return () => setTitle?.('')
  }, [setTitle])

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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (labourQuery.isError) {
    return <ApiErrorAlert error={parseApiError(labourQuery.error)} />
  }

  if (sessionsQuery.isError || runningQuery.isError) {
    return (
      <ApiErrorAlert
        error={parseApiError(sessionsQuery.error || runningQuery.error)}
      />
    )
  }

  return (
    <div className="max-w-lg mx-auto overflow-x-auto">
      <table className="table table-sm w-full">
        <thead>
          <tr className="border-b border-base-300">
            <th className="w-10">নং</th>
            <th>সময়কাল</th>
            <th className="text-right whitespace-nowrap">এই সেশন</th>
            <th className="text-right whitespace-nowrap">মোট পাওনা</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="text-center text-sm text-base-content/60 py-8"
              >
                কোনো সেশন নেই।
              </td>
            </tr>
          ) : (
            sessions.map((session, index) => (
              <tr
                key={
                  session.is_running
                    ? `running-${session.start_date}`
                    : String(session.id)
                }
                className={[
                  'border-b border-base-300/70 cursor-pointer',
                  session.is_running
                    ? 'bg-primary/10 hover:bg-primary/15'
                    : 'hover:bg-base-200/60',
                ].join(' ')}
                onClick={() => {
                  navigate(
                    session.is_running || session.id == null
                      ? paths.labourRunningSession(labourId)
                      : paths.labourSessionDetail(labourId, session.id),
                  )
                }}
              >
                <td className="tabular-nums text-base-content/60">
                  {formatBnNumber(index + 1)}
                </td>
                <td className="font-medium text-sm whitespace-nowrap">
                  {formatPeriod(session)}
                </td>
                <td className="text-right tabular-nums">
                  {formatBnNumber(session.payable)}
                </td>
                <td className="text-right tabular-nums font-medium">
                  {formatBnNumber(session.cumulative_payable)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
