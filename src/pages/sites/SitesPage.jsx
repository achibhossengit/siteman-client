import { useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fetchSites } from '../../api/sites.js'
import {
  normalizeSiteList,
  siteStatusClass,
  siteStatusLabel,
} from '../../api/types/site.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { formatBnNumber } from '../../utils/format.js'
import { paths } from '../../router/paths.js'

export const SitesPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()

  useEffect(() => {
    setTitle?.('সাইট ম্যানেজ')
    return () => setTitle?.('')
  }, [setTitle])

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const { data } = await fetchSites()
      return normalizeSiteList(data)
    },
  })

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

  const rows = sitesQuery.data ?? []

  return (
    <section className="relative min-h-full flex flex-col pb-20">
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm sm:table-md w-full">
          <thead>
            <tr className="border-b border-base-300">
              <th className="w-12">নং</th>
              <th>নাম</th>
              <th className="w-28 text-right">স্ট্যাটাস</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  কোনো সাইট নেই।
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

      <button
        type="button"
        className="btn btn-primary btn-circle btn-lg fixed bottom-4 right-4 z-40 shadow-lg"
        aria-label="নতুন সাইট"
        onClick={() => navigate(paths.siteNew)}
      >
        <Plus className="size-7" strokeWidth={2} />
      </button>
    </section>
  )
}
