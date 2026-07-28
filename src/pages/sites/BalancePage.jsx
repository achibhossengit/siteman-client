import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  User,
  Banknote,
  Landmark,
  Hammer,
  ArrowUpFromLine,
  Wallet,
  Undo2,
  Calculator,
  Coins,
  PlusCircle,
  CircleDollarSign,
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
  dashed = false,
}) => (
  <div
    className={[
      'flex items-center gap-2 py-2',
      dashed
        ? 'border-b border-dashed border-base-300'
        : 'border-b border-base-300',
    ].join(' ')}
  >
    <Icon className={`size-5 shrink-0 ${iconClassName}`} strokeWidth={1.75} />
    <span className={`flex-1 text-sm sm:text-base ${labelClassName}`}>
      {label}
    </span>
    <span className={`text-sm sm:text-base text-right ${valueClassName}`}>
      {value}
    </span>
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
    labour_session_count,
    present_count,
    previous_balance,
    deposit,
    site_cost,
    withdrawal,
    labour_payment,
    labour_return,
    total_salary,
    extra_earnings,
    total_cost,
    remaining,
    balance,
  } = report

  return (
    <section className="flex-1 min-h-0 overflow-y-auto p-2">
      <Row
        icon={User}
        label={`লেবার ${formatBnNumber(labour_session_count)} জন`}
        value={`${formatBnNumber(present_count, { maximumFractionDigits: 2 })} রোজ`}
      />

      <Row
        icon={Coins}
        label="মোট বেতন"
        value={formatBnNumber(total_salary)}
        dashed
      />
      <Row
        icon={PlusCircle}
        label="অতিরিক্ত"
        value={formatBnNumber(extra_earnings)}
      />

      <Row
        icon={Banknote}
        label="আগের ব্যালেন্স"
        value={formatBnNumber(previous_balance)}
        valueClassName="font-semibold tabular-nums text-success"
        />

      <Row
        icon={Landmark}
        label="Cash In"
        value={formatBnSigned(deposit, { showPlus: true })}
        valueClassName="font-semibold tabular-nums text-success"
      />

    <Row
      icon={ArrowUpFromLine}
      label="Cash Out"
      value={formatBnNumber(withdrawal)}
      dashed
    />
      <Row
        icon={Hammer}
        label="সাইট খরচ"
        value={formatBnNumber(site_cost)}
        dashed
      />
      <Row
        icon={Wallet}
        label="লেবার পেমেন্ট"
        value={formatBnNumber(labour_payment)}
        dashed
      />
      <Row
        icon={Undo2}
        label="লেবার রিটার্ন"
        value={formatBnNumber(labour_return)}
        valueClassName="font-semibold tabular-nums text-success"
      />

      <Row
        icon={Calculator}
        label="মোট খরচ"
        value={formatBnSigned(-Math.abs(total_cost), { showPlus: false })}
        valueClassName="font-semibold tabular-nums"
      />

      <Row
        icon={CircleDollarSign}
        label="অবশিষ্ট"
        value={formatBnNumber(remaining)}
      />

      <div className="flex items-center gap-3 py-2.5 px-1">
        <Banknote
          className="size-5 shrink-0 text-success"
          strokeWidth={1.75}
        />
        <span className="flex-1 text-sm sm:text-base text-success font-medium">
          ব্যালেন্স
        </span>
        <span className="text-sm sm:text-base text-right font-bold tabular-nums text-success">
          {formatBnNumber(balance)}
        </span>
      </div>
    </section>
  )
}
