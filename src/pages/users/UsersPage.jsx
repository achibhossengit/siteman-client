import { useEffect } from 'react'
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
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

export const UsersPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const { can } = usePermissions()

  const canViewUser = can(PERMS.viewUser)
  const canAddUser = can(PERMS.addUser)

  useEffect(() => {
    setTitle?.('ইউজার ম্যানেজ')
    return () => setTitle?.('')
  }, [setTitle])

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await fetchUsers()
      return Array.isArray(data) ? data : []
    },
    enabled: canViewUser,
  })

  if (!canViewUser) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (usersQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (usersQuery.isError) {
    return <ApiErrorAlert error={parseApiError(usersQuery.error)} />
  }

  const rows = usersQuery.data ?? []

  return (
    <section className="relative min-h-full flex flex-col pb-20">
      <div className="overflow-x-auto">
        <table className="table table-sm sm:table-md w-full">
          <thead>
            <tr className="border-b border-base-300">
              <th className="w-12">নং</th>
              <th>নাম</th>
              <th className="hidden sm:table-cell">ফোন</th>
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
                  কোনো ইউজার নেই।
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
                    {formatBnNumber(index + 1)}
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
