import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fetchUsers } from '../../api/users.js'
import {
  userStatusClass,
  userStatusLabel,
} from '../../api/types/user.js'
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

export const UsersPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const { can } = usePermissions()
  const [nameQuery, setNameQuery] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const canViewUser = can(PERMS.viewUser)
  const canAddUser = can(PERMS.addUser)

  useEffect(() => {
    setTitle?.('ইউজার ম্যানেজ')
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

  const usersQuery = useQuery({
    queryKey: [
      'users',
      'list',
      { page, page_size: PAGE_SIZE, search, statusFilter },
    ],
    queryFn: async () => {
      const { data } = await fetchUsers({
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...statusParams(statusFilter),
      })
      return data
    },
    enabled: canViewUser,
    placeholderData: (previousData) => previousData,
  })

  const pageData = usersQuery.data ?? {
    results: [],
    count: 0,
    next: null,
    previous: null,
  }
  const rows = pageData.results ?? []
  const totalCount = pageData.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const slOffset = (page - 1) * PAGE_SIZE

  if (!canViewUser) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (usersQuery.isLoading && !usersQuery.data) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (usersQuery.isError) {
    return <ApiErrorAlert error={parseApiError(usersQuery.error)} />
  }

  const emptyLabel =
    totalCount === 0 ? 'কোনো ইউজার নেই।' : 'কোনো মিল পাওয়া যায়নি।'

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
              <th className="hidden sm:table-cell">ফোন</th>
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
                  onClick={() => navigate(paths.userDetail(row.id))}
                >
                  <td className="tabular-nums text-base-content/60">
                    {formatBnNumber(slOffset + index + 1)}
                  </td>
                  <td className="font-medium">
                    <div className="truncate max-w-40 sm:max-w-none">
                      {row.name}
                    </div>
                    <div className="sm:hidden text-xs text-base-content/60 tabular-nums truncate">
                      {row.phone_number || '—'}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell tabular-nums text-sm text-base-content/80">
                    {row.phone_number || '—'}
                  </td>
                  <td className="text-right">
                    <span className={`badge badge-sm ${userStatusClass(row)}`}>
                      {userStatusLabel(row)}
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
        isFetching={usersQuery.isFetching}
        onPageChange={setPage}
      />

      {canAddUser ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-4 right-4 z-40 shadow-lg"
          aria-label="নতুন ইউজার"
          onClick={() => navigate(paths.userNew)}
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>
      ) : null}
    </section>
  )
}
