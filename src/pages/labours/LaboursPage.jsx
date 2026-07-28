import { useEffect, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fetchLabours } from '../../api/labours.js'
import { fetchSites } from '../../api/sites.js'
import {
  labourStatusClass,
  labourStatusLabel,
} from '../../api/types/labour.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

export const LaboursPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const { can } = usePermissions()

  const canViewLabour = can(PERMS.viewLabour)
  const canAddLabour = can(PERMS.addLabour)

  useEffect(() => {
    setTitle?.('লেবার ম্যানেজ')
    return () => setTitle?.('')
  }, [setTitle])

  const laboursQuery = useQuery({
    queryKey: ['labours'],
    queryFn: async () => {
      const { data } = await fetchLabours()
      return Array.isArray(data) ? data : []
    },
    enabled: canViewLabour,
  })

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await fetchSites()
      return Array.isArray(data) ? data : []
    },
    enabled: canViewLabour,
  })

  const siteNameById = useMemo(() => {
    const map = new Map()
    for (const s of sitesQuery.data ?? []) {
      map.set(s.id, s.name)
    }
    return map
  }, [sitesQuery.data])

  const siteLabel = (id) => {
    if (id == null) return '—'
    return siteNameById.get(id) ?? `#${id}`
  }

  if (!canViewLabour) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (laboursQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (laboursQuery.isError) {
    return <ApiErrorAlert error={parseApiError(laboursQuery.error)} />
  }

  const rows = laboursQuery.data ?? []

  return (
    <section className="relative min-h-full flex flex-col pb-20">
      <div className="overflow-x-auto">
        <table className="table table-sm sm:table-md w-full">
          <thead>
            <tr className="border-b border-base-300">
              <th className="w-12">নং</th>
              <th>নাম</th>
              <th className="hidden sm:table-cell">সাইট</th>
              <th className="w-28 text-right">স্ট্যাটাস</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  কোনো লেবার নেই।
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                  onClick={() => navigate(paths.labourDetail(row.id))}
                >
                  <td className="tabular-nums text-base-content/60">
                    {formatBnNumber(index + 1)}
                  </td>
                  <td className="font-medium">
                    <div className="truncate max-w-40 sm:max-w-none">
                      {row.name}
                    </div>
                    <div className="sm:hidden text-xs text-base-content/60 truncate">
                      {siteLabel(row.current_site)}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell truncate text-sm text-base-content/80 max-w-40">
                    {siteLabel(row.current_site)}
                  </td>
                  <td className="text-right">
                    <span
                      className={`badge badge-sm ${labourStatusClass(row)}`}
                    >
                      {labourStatusLabel(row)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canAddLabour ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-4 right-4 z-40 shadow-lg"
          aria-label="নতুন লেবার"
          onClick={() => navigate(paths.labourNew)}
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>
      ) : null}
    </section>
  )
}
