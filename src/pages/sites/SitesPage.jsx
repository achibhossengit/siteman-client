import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fetchSites } from '../../api/sites.js'
import {
  siteStatusClass,
  siteStatusLabel,
} from '../../api/types/site.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

const STATUS_OPTIONS = [
  { value: 'all', label: 'স্ট্যাটাস' },
  { value: 'active', label: 'সক্রিয়' },
  { value: 'inactive', label: 'নিষ্ক্রিয়' },
  { value: 'closed', label: 'সমাপ্ত' },
]

const matchesStatus = (site, status) => {
  if (status === 'all') return true
  if (status === 'closed') return Boolean(site.is_closed)
  if (status === 'inactive') return !site.is_closed && !site.is_active
  if (status === 'active') return !site.is_closed && Boolean(site.is_active)
  return true
}

const matchesName = (name, query) => {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return String(name ?? '')
    .toLowerCase()
    .includes(needle)
}

export const SitesPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const { can } = usePermissions()
  const [nameQuery, setNameQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const canViewSite = can(PERMS.viewSite)
  const canAddSite = can(PERMS.addSite)

  useEffect(() => {
    setTitle?.('সাইট ম্যানেজ')
    return () => setTitle?.('')
  }, [setTitle])

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await fetchSites({ all: true })
      return Array.isArray(data) ? data : []
    },
    enabled: canViewSite,
  })

  const allRows = sitesQuery.data ?? []
  const rows = useMemo(
    () =>
      allRows.filter(
        (row) =>
          matchesName(row.name, nameQuery) &&
          matchesStatus(row, statusFilter),
      ),
    [allRows, nameQuery, statusFilter],
  )

  if (!canViewSite) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (sitesQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (sitesQuery.isError) {
    return <ApiErrorAlert error={parseApiError(sitesQuery.error)} />
  }

  const emptyLabel =
    allRows.length === 0 ? 'কোনো সাইট নেই।' : 'কোনো মিল পাওয়া যায়নি।'

  return (
    <section className="relative min-h-full flex flex-col pb-20">
      <div className="overflow-x-auto">
        <table className="table table-sm sm:table-md w-full">
          <thead>
            <tr className="border-b border-base-300">
              <th className="w-12">নং</th>
              <th>
                <input
                  type="search"
                  className="input input-bordered input-sm w-full min-w-0 font-normal"
                  placeholder="নাম খুঁজুন"
                  aria-label="নাম খুঁজুন"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                />
              </th>
              <th className="w-28">
                <select
                  className="select select-bordered select-sm w-full font-normal"
                  aria-label="স্ট্যাটাস"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                  onClick={() => navigate(paths.siteDetail(row.id))}
                >
                  <td className="tabular-nums text-base-content/60">
                    {formatBnNumber(index + 1)}
                  </td>
                  <td className="font-medium truncate max-w-48 sm:max-w-none">
                    {row.name}
                  </td>
                  <td className="text-right">
                    <span
                      className={`badge badge-sm ${siteStatusClass(row)}`}
                    >
                      {siteStatusLabel(row)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canAddSite ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-4 right-4 z-40 shadow-lg"
          aria-label="নতুন সাইট"
          onClick={() => navigate(paths.siteNew)}
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>
      ) : null}
    </section>
  )
}
