import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fetchLabours } from '../../api/labours.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { ListPagination } from '../../components/ListPagination.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { useAssignedSites } from '../../hooks/useSites.js'
import { formatBnNumber, NULL_SITE_LABEL } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'
import { LabourCreateModal } from './LabourCreateModal.jsx'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 400

export const LaboursPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const { can, isCompanyAdmin } = usePermissions()
  const createModalRef = useRef(null)
  const { assignedSites, getSiteName } = useAssignedSites({
    includeClosed: true,
  })
  const [nameQuery, setNameQuery] = useState('')
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('all')
  const [page, setPage] = useState(1)

  const canViewLabour = can(PERMS.viewLabour)
  const canAddLabour = can(PERMS.addLabour)

  const siteFilterOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'সব সাইট' }]
    if (isCompanyAdmin) {
      options.push({ value: 'unassigned', label: NULL_SITE_LABEL })
    }
    for (const s of assignedSites) {
      options.push({
        value: String(s.id),
        label: getSiteName(s.id),
      })
    }
    return options
  }, [assignedSites, isCompanyAdmin, getSiteName])

  useEffect(() => {
    setTitle?.('লেবার ম্যানেজ')
    return () => setTitle?.('')
  }, [setTitle])

  // Debounce search: request only after typing stops.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(nameQuery.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [nameQuery])

  useEffect(() => {
    setPage(1)
  }, [search, siteFilter])

  const laboursQuery = useQuery({
    queryKey: [
      'labours',
      'list',
      { page, page_size: PAGE_SIZE, search, siteFilter },
    ],
    queryFn: async () => {
      const { data } = await fetchLabours({
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(siteFilter !== 'all' ? { current_site: siteFilter } : {}),
      })
      return data
    },
    enabled: canViewLabour,
    placeholderData: (previousData) => previousData,
  })

  const siteLabel = (id) => getSiteName(id)

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

  const emptyLabel = search
    ? 'কোনো মিল পাওয়া যায়নি।'
    : siteFilter !== 'all'
      ? 'এই ফিল্টারে কোনো লেবার নেই।'
      : 'কোনো লেবার নেই।'

  return (
    <section className="relative h-full min-h-0 flex flex-col pb-20">
      <div className="shrink-0 grid grid-cols-2 gap-2 px-2 pt-2 pb-2">
        <input
          type="search"
          className="input input-bordered input-sm w-full min-w-0"
          placeholder="নাম খুঁজুন"
          aria-label="নাম খুঁজুন"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
        />
        <select
          className="select select-bordered select-sm w-full min-w-0"
          aria-label="বর্তমান সাইট"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          {siteFilterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-2">
        <table className="table table-sm sm:table-md w-full">
          <thead className="sticky top-0 z-10 bg-base-100">
            <tr className="border-b-2 border-base-300">
              <th className="w-12">নং</th>
              <th>নাম</th>
              <th>বর্তমান সাইট</th>
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
              rows.map((row, index) => {
                const inactive = row.is_active === false
                return (
                  <tr
                    key={row.id}
                    className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                    onClick={() => navigate(paths.labourDetail(row.id))}
                  >
                    <td className="tabular-nums text-base-content/60">
                      {formatBnNumber(slOffset + index + 1)}
                    </td>
                    <td
                      className={`font-medium truncate max-w-48 ${
                        inactive ? 'text-base-content/40' : ''
                      }`}
                      title={row.name}
                    >
                      {row.name}
                    </td>
                    <td className="truncate text-sm text-base-content/80 max-w-40">
                      {siteLabel(row.current_site)}
                    </td>
                  </tr>
                )
              })
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
        <>
          <button
            type="button"
            className="btn btn-primary btn-circle btn-lg fixed bottom-4 right-4 z-40 shadow-lg"
            aria-label="নতুন লেবার"
            onClick={() => createModalRef.current?.open()}
          >
            <Plus className="size-7" strokeWidth={2} />
          </button>
          <LabourCreateModal ref={createModalRef} />
        </>
      ) : null}
    </section>
  )
}
