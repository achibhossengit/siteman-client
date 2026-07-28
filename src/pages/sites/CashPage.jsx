import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fetchSiteCash } from '../../api/sites.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { formatBnNumber, formatBnSigned } from '../../utils/format.js'
import { paths } from '../../router/paths.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { PERMS } from '../../utils/permissions.js'

/** deposit = credit (+); withdrawal / cost = debit (−). Distinct color per type. */
const AMOUNT_BY_TYPE = {
  deposit: {
    sign: 1,
    className: 'text-success',
  },
  withdrawal: {
    sign: -1,
    className: 'text-warning',
  },
  cost: {
    sign: -1,
    className: 'text-error',
  },
}

const formatCashAmount = (type, amount) => {
  const style = AMOUNT_BY_TYPE[type] ?? AMOUNT_BY_TYPE.cost
  return {
    text: formatBnSigned(style.sign * Math.abs(Number(amount) || 0)),
    className: style.className,
  }
}

export const CashPage = () => {
  const { date, siteId, sites } = useOutletContext()
  const navigate = useNavigate()
  const { can } = usePermissions()

  const canViewCash = can(PERMS.viewSiteCash)
  const canAddCash = can(PERMS.addSiteCash)

  const site = (sites ?? []).find((s) => String(s.id) === String(siteId))
  const siteInactive = site?.is_active === false

  const cashQuery = useQuery({
    queryKey: ['sites', siteId, 'cash', { date }],
    queryFn: async () => {
      const { data } = await fetchSiteCash(siteId, { date })
      return Array.isArray(data) ? data : []
    },
    enabled: Boolean(canViewCash && siteId && date),
  })

  if (!canViewCash) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-error">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (!siteId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-base-content/70">
        ক্যাশ দেখতে একটি সাইট নির্বাচন করুন।
      </div>
    )
  }

  if (cashQuery.isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (cashQuery.isError) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ApiErrorAlert error={parseApiError(cashQuery.error)} />
      </div>
    )
  }

  const rows = cashQuery.data ?? []

  return (
    <section className="flex-1 min-h-0 flex flex-col relative">
      <div className="shrink-0 bg-base-100 border-b border-base-300">
        <table className="table table-fixed table-sm sm:table-md w-full">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-28 sm:w-36" />
          </colgroup>
          <thead>
            <tr>
              <th>নং</th>
              <th>বিবরণ</th>
              <th className="text-right">পরিমাণ</th>
            </tr>
          </thead>
        </table>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="table table-fixed table-sm sm:table-md w-full">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-28 sm:w-36" />
          </colgroup>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  এই তারিখে কোনো ক্যাশ এন্ট্রি নেই।
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const { text, className } = formatCashAmount(
                  row.type,
                  row.amount,
                )
                return (
                  <tr
                    key={row.id}
                    className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                    onClick={() => navigate(paths.cashDetail(row.id))}
                  >
                    <td className="tabular-nums text-base-content/60">
                      {formatBnNumber(index + 1)}
                    </td>
                    <td className="truncate">{row.note || '—'}</td>
                    <td
                      className={`text-right tabular-nums font-medium ${className}`}
                    >
                      {text}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {canAddCash ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-16 right-4 z-40 shadow-lg"
          aria-label="নতুন ক্যাশ"
          onClick={() => navigate(paths.cashNew)}
          disabled={!date || siteInactive}
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>
      ) : null}
    </section>
  )
}
