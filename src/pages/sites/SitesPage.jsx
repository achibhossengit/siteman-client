import { useEffect, useState } from 'react'
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
import { ListPagination } from '../../components/ListPagination.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'all', label: 'স্ট্যাটাস' },
  { value: 'active', label: 'সক্রিয়' },
  { value: 'inactive', label: 'নিষ্ক্রিয়' },
  { value: 'closed', label: 'সমাপ্ত' },
]

const statusParams = (status) => {
  if (status === 'closed') return { is_closed: true }
  if (status === 'inactive') return { is_active: false, is_closed: false }
  if (status === 'active') return { is_active: true, is_closed: false }
  return {}
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
  const [page, setPage] = useState(1)

  const canViewSite = can(PERMS.viewSite)
  const canAddSite = can(PERMS.addSite)

  useEffect(() => {
    setTitle?.('সাইট ম্যানেজ')
    return () => setTitle?.('')
  }, [setTitle])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, nameQuery])

  const sitesQuery = useQuery({
    queryKey: ['sites', 'list', { page, page_size: PAGE_SIZE, statusFilter }],
    queryFn: async () => {
      const { data } = await fetchSites({
        page,
        page_size: PAGE_SIZE,
        ...statusParams(statusFilter),
      })
      return data
    },
    enabled: canViewSite,
    placeholderData: (previousData) => previousData,
  })

  const pageData = sitesQuery.data ?? {
    results: [],
    count: 0,
    next: null,
    previous: null,
  }
  const pageRows = pageData.results ?? []
  const totalCount = pageData.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const slOffset = (page - 1) * PAGE_SIZE

  // Sites list has no search param — filter the current page only.
  const rows = nameQuery.trim()
    ? pageRows.filter((row) => matchesName(row.name, nameQuery))
    : pageRows

  if (!canViewSite) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (sitesQuery.isLoading && !sitesQuery.data) {
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
    totalCount === 0 ? 'কোনো সাইট নেই।' : 'কোনো মিল পাওয়া যায়নি।'

  return (
    <section className="relative min-h-full flex flex-col pb-20">
      <div className="flex-1 min-h-0 overflow-x-auto">
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
                    {formatBnNumber(slOffset + index + 1)}
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

      <ListPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        isFetching={sitesQuery.isFetching}
        onPageChange={setPage}
      />

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
