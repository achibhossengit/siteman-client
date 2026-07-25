import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fetchSiteCash } from '../../api/sites.js'
import { normalizeSiteCashList } from '../../api/types/siteCash.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { CashCreateModal } from '../../components/cash/CashCreateModal.jsx'
import { CashDetailModal } from '../../components/cash/CashDetailModal.jsx'
import { formatBnSigned } from '../../utils/format.js'

/** deposit = credit (+); withdrawal / cost = debit (−). Distinct color per type. */
const AMOUNT_BY_TYPE = {
  deposit: {
    sign: 1,
    className: 'text-success',
  },
  withdrawal: {
    sign: -1,
    className: 'text-error',
  },
  cost: {
    sign: -1,
    className: 'text-warning',
  },
}

const formatCashAmount = (type, amount) => {
  const style = AMOUNT_BY_TYPE[type] ?? AMOUNT_BY_TYPE.cost
  return {
    text: formatBnSigned(style.sign * Math.abs(Number(amount) || 0)),
    className: style.className,
  }
}

const summarizeCash = (rows) =>
  rows.reduce(
    (acc, row) => {
      const amount = Math.abs(Number(row.amount) || 0)
      if (row.type === 'deposit') acc.deposit += amount
      else if (row.type === 'withdrawal') acc.withdrawal += amount
      else if (row.type === 'cost') acc.cost += amount
      return acc
    },
    { deposit: 0, withdrawal: 0, cost: 0 },
  )

export const CashPage = () => {
  const { date, siteId } = useOutletContext()
  const createRef = useRef(null)
  const detailRef = useRef(null)
  const [selectedCashId, setSelectedCashId] = useState(null)

  const cashQuery = useQuery({
    queryKey: ['sites', siteId, 'cash', { date }],
    queryFn: async () => {
      const { data } = await fetchSiteCash(siteId, { date })
      return normalizeSiteCashList(data)
    },
    enabled: Boolean(siteId && date),
  })

  const openCreate = () => {
    createRef.current?.showModal()
  }

  const openDetail = (id) => setSelectedCashId(id)

  const clearSelected = () => setSelectedCashId(null)

  useEffect(() => {
    if (selectedCashId == null) return
    detailRef.current?.showModal()
  }, [selectedCashId])

  if (!siteId) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-base-content/70">
        ক্যাশ দেখতে একটি সাইট নির্বাচন করুন।
      </div>
    )
  }

  if (cashQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (cashQuery.isError) {
    return <ApiErrorAlert error={parseApiError(cashQuery.error)} />
  }

  const rows = cashQuery.data ?? []
  const { deposit, withdrawal, cost } = summarizeCash(rows)

  return (
    <section className="relative pb-16">
      <div className="overflow-x-auto h-96 w-full">
        <table className="table table-pin-rows table-sm sm:table-md">
          <thead>
            <tr className="border-b border-base-300">
              <th>নোট</th>
              <th className="text-right">পরিমাণ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  এই তারিখে কোনো ক্যাশ এন্ট্রি নেই।
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const { text, className } = formatCashAmount(
                  row.type,
                  row.amount,
                )
                return (
                  <tr
                    key={row.id}
                    className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                    onClick={() => openDetail(row.id)}
                  >
                    <td className="max-w-56 truncate">{row.note || '—'}</td>
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
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-base-300">
                <td colSpan={2} className="p-0">
                  <div className="grid grid-cols-3 divide-x divide-base-300">
                    <div
                      className={`px-2 py-2 text-center tabular-nums font-semibold ${AMOUNT_BY_TYPE.deposit.className}`}
                    >
                      {formatBnSigned(deposit)}
                    </div>
                    <div
                      className={`px-2 py-2 text-center tabular-nums font-semibold ${AMOUNT_BY_TYPE.withdrawal.className}`}
                    >
                      {formatBnSigned(-withdrawal)}
                    </div>
                    <div
                      className={`px-2 py-2 text-center tabular-nums font-semibold ${AMOUNT_BY_TYPE.cost.className}`}
                    >
                      {formatBnSigned(-cost)}
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-circle btn-lg fixed bottom-20 right-4 z-40 shadow-lg"
        aria-label="নতুন ক্যাশ"
        onClick={openCreate}
        disabled={!date}
      >
        <Plus className="size-7" strokeWidth={2} />
      </button>

      <CashCreateModal dialogRef={createRef} siteId={siteId} date={date} />

      <CashDetailModal
        dialogRef={detailRef}
        siteId={siteId}
        cashId={selectedCashId}
        onClose={clearSelected}
      />
    </section>
  )
}
