import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote,
  Landmark,
  Hammer,
  ArrowUpFromLine,
  Wallet,
  Undo2,
} from 'lucide-react'
import { fetchDailyReport } from '../../api/sites.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { formatBnNumber, formatBnSigned } from '../../utils/format.js'

const Row = ({
  icon: Icon,
  label,
  value,
  iconClassName = 'text-base-content/55',
  labelClassName = '',
  valueClassName = 'font-medium tabular-nums',
}) => (
  <div className="flex items-center gap-2 py-2">
    <Icon className={`size-5 shrink-0 ${iconClassName}`} strokeWidth={1.75} />
    <span className={`flex-1 text-sm sm:text-base ${labelClassName}`}>
      {label}
    </span>
    <span className={`text-sm sm:text-base text-right ${valueClassName}`}>
      {value}
    </span>
  </div>
)

/** Sum line from the sketch: a rule, then the bare figure on the right. */
const SubtotalRow = ({ value, valueClassName }) => (
  <div className="border-t border-base-content/20 mt-1 pt-2 pb-1">
    <div className={`text-sm sm:text-base text-right ${valueClassName}`}>
      {value}
    </div>
  </div>
)

export const BalancePage = () => {
  const { date, siteId } = useOutletContext()

  const query = useQuery({
    queryKey: ['sites', siteId, 'daily-reports', date],
    queryFn: async () => {
      const { data } = await fetchDailyReport(siteId, date)
      return data
    },
    enabled: Boolean(siteId && date),
  })

  if (!siteId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        হিসাব দেখতে একটি সাইট নির্বাচন করুন।
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ApiErrorAlert error={parseApiError(query.error)} />
      </div>
    )
  }

  const report = query.data
  if (!report) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="alert bg-base-100 border border-base-300 text-sm">
          এই তারিখে কোনো হিসাব পাওয়া যায়নি।
        </div>
      </div>
    )
  }

  const {
    previous_balance,
    deposit,
    labour_return,
    withdrawal,
    site_cost,
    labour_payment,
    balance,
  } = report

  const creditTotal =
    (Number(previous_balance) || 0) +
    (Number(deposit) || 0) +
    (Number(labour_return) || 0)

  return (
    <section className="flex-1 min-h-0 overflow-y-auto p-2">
      <Row
        icon={Banknote}
        label="আগের ব্যালেন্স"
        value={formatBnNumber(previous_balance)}
        valueClassName="font-semibold tabular-nums text-success"
      />
      <Row
        icon={Landmark}
        label="সাইট জমা"
        value={formatBnSigned(deposit, { showPlus: true })}
        valueClassName="font-semibold tabular-nums text-success"
      />
      <Row
        icon={Undo2}
        label="লেবার রিটার্ন"
        value={formatBnSigned(labour_return, { showPlus: true })}
        valueClassName="font-semibold tabular-nums text-success"
      />

      <SubtotalRow
        value={formatBnNumber(creditTotal)}
        valueClassName="font-semibold tabular-nums text-success"
      />

      <Row
        icon={ArrowUpFromLine}
        label="ক্যাশ আউট"
        value={formatBnSigned(-(Math.abs(Number(withdrawal) || 0)), {
          showPlus: false,
        })}
        valueClassName="font-semibold tabular-nums text-error"
      />
      <Row
        icon={Hammer}
        label="সাইট খরচ"
        value={formatBnSigned(-(Math.abs(Number(site_cost) || 0)), {
          showPlus: false,
        })}
        valueClassName="font-semibold tabular-nums text-error"
      />
      <Row
        icon={Wallet}
        label="লেবার পেমেন্ট"
        value={formatBnSigned(-(Math.abs(Number(labour_payment) || 0)), {
          showPlus: false,
        })}
        valueClassName="font-semibold tabular-nums text-error"
      />

      <div className="flex items-center gap-2 border-t border-base-content/20 mt-1 pt-2">
        <span className="flex items-center gap-2 flex-1 text-sm sm:text-base text-success font-medium">
          <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
          ব্যালেন্স
        </span>
        <span className="text-sm sm:text-base text-right font-bold tabular-nums text-success">
          {formatBnNumber(balance)}
        </span>
      </div>
 
    </section>
  )
}
