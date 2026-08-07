import { useEffect, useMemo, useState } from 'react'
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
import { ListPagination } from '../../components/ListPagination.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

const STATUS_OPTIONS = [
  { value: 'all', label: 'স্ট্যাটাস' },
  { value: 'active', label: 'সক্রিয়' },
  { value: 'inactive', label: 'নিষ্ক্রিয়' },
]

const statusParams = (status) => {
  if (status === 'active') return { is_active: true }
  if (status === 'inactive') return { is_active: false }
  return {}
}

export const LaboursPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const { can } = usePermissions()
  const [nameQuery, setNameQuery] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const canViewLabour = can(PERMS.viewLabour)
  const canAddLabour = can(PERMS.addLabour)

  useEffect(() => {
    setTitle?.('লেবার ম্যানেজ')
    return () => setTitle?.('')
  }, [setTitle])

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(nameQuery.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [nameQuery])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const laboursQuery = useQuery({
    queryKey: [
      'labours',
      'list',
      { page, page_size: PAGE_SIZE, search, statusFilter },
    ],
    queryFn: async () => {
      const { data } = await fetchLabours({
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...statusParams(statusFilter),
      })
      return data
    },
    enabled: canViewLabour,
    placeholderData: (previousData) => previousData,
  })

  // Site names for the current labour page (lookup map; not list-paginated UI).
  const sitesQuery = useQuery({
    queryKey: ['sites', 'names'],
    queryFn: async () => {
      const { data } = await fetchSites({ page: 1, page_size: 100 })
      return data?.results ?? []
    },
    enabled: canViewLabour,
    staleTime: 60_000,
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

  const pageData = laboursQuery.data ?? {
    results: [],
    count: 0,
    next: null,
    previous: null,
  }
  const rows = pageData.results ?? []
  const totalCount = pageData.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const slOffset = (page - 1) * PAGE_SIZE

  if (!canViewLabour) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (laboursQuery.isLoading && !laboursQuery.data) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (laboursQuery.isError) {
    return <ApiErrorAlert error={parseApiError(laboursQuery.error)} />
  }

  const emptyLabel =
    totalCount === 0 ? 'কোনো লেবার নেই।' : 'কোনো মিল পাওয়া যায়নি।'

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
              <th className="hidden sm:table-cell">সাইট</th>
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
                  colSpan={4}
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
                  onClick={() => navigate(paths.labourDetail(row.id))}
                >
                  <td className="tabular-nums text-base-content/60">
                    {formatBnNumber(slOffset + index + 1)}
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

      <ListPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        isFetching={laboursQuery.isFetching}
        onPageChange={setPage}
      />

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
