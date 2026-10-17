import { useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote,
  CalendarCheck,
  Wallet,
} from 'lucide-react'
import { fetchDailyReport } from '../../api/sites.js'
import { cashTypeLabel } from '../../api/types/siteCash.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { formatBnNumber, formatBnSigned } from '../../utils/format.js'
import { paths } from '../../router/paths.js'
import {
  writeCashFocus,
  writeHajiraFocus,
} from '../../utils/sessionSelection.js'
import {
  dateFilterParams,
  isMultiDaySelection,
} from '../../utils/dateRange.js'

const Row = ({
  icon: Icon,
  label,
  value,
  iconClassName = 'text-base-content/55',
  labelClassName = '',
  valueClassName = 'font-medium tabular-nums',
  onLabelClick,
}) => (
  <div className="flex items-center gap-2 py-2">
    <Icon className={`size-5 shrink-0 ${iconClassName}`} strokeWidth={1.75} />
    <span className={`flex-1 text-sm sm:text-base ${labelClassName}`}>
      {onLabelClick ? (
        <button
          type="button"
          className="link underline underline-offset-2"
          onClick={onLabelClick}
        >
          {label}
        </button>
      ) : (
        label
      )}
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
  const { date, dateEnd, siteId } = useOutletContext()
  const navigate = useNavigate()
  const isRange = isMultiDaySelection(date, dateEnd)
  const reportParams = useMemo(
    () => dateFilterParams(date, dateEnd),
    [date, dateEnd],
  )

  const query = useQuery({
    queryKey: ['sites', siteId, 'daily-reports', reportParams],
    queryFn: async () => {
      const { data } = await fetchDailyReport(siteId, reportParams)
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
          {isRange
            ? 'এই সময়ে কোনো হিসাব পাওয়া যায়নি।'
            : 'এই তারিখে কোনো হিসাব পাওয়া যায়নি।'}
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

  const openCashFocus = (cashFocus) => () => {
    writeCashFocus(cashFocus)
    navigate(paths.cash, { state: { cashFocus } })
  }

  const openHajiraFocus = (hajiraFocus) => () => {
    writeHajiraFocus(hajiraFocus)
    navigate(paths.hajira, { state: { hajiraFocus } })
  }

  const creditTotal =
    (Number(previous_balance) || 0) + (Number(deposit) || 0)

  return (
    <section className="flex-1 min-h-0 overflow-y-auto p-2">
      <Row
        icon={Banknote}
        label="আগের ব্যালেন্স"
        value={formatBnNumber(previous_balance)}
        valueClassName={`font-semibold tabular-nums ${Number(previous_balance) >= 0 ? 'text-success' : 'text-error'}`}
      />
      <Row
        icon={Wallet}
        label={cashTypeLabel('deposit')}
        onLabelClick={openCashFocus('deposit')}
        value={formatBnSigned(deposit, { showPlus: true })}
        valueClassName="font-semibold tabular-nums text-success"
      />

      <SubtotalRow
        value={formatBnNumber(creditTotal)}
        valueClassName={`font-semibold tabular-nums ${Number(creditTotal) >= 0 ? 'text-success' : 'text-error'}`}
      />

      <Row
        icon={Wallet}
        label={cashTypeLabel('withdrawal')}
        onLabelClick={openCashFocus('withdrawal')}
        value={formatBnSigned(-(Math.abs(Number(withdrawal) || 0)), {
          showPlus: false,
        })}
        valueClassName="font-semibold tabular-nums text-warning"
      />
      <Row
        icon={Wallet}
        label={cashTypeLabel('cost')}
        onLabelClick={openCashFocus('cost')}
        value={formatBnSigned(-(Math.abs(Number(site_cost) || 0)), {
          showPlus: false,
        })}
        valueClassName="font-semibold tabular-nums text-error"
      />
      <Row
        icon={CalendarCheck}
        label="শ্রমিকদের দেওয়া"
        onLabelClick={openHajiraFocus('given')}
        value={formatBnSigned(-(Math.abs(Number(labour_payment) || 0)), {
          showPlus: false,
        })}
        valueClassName="font-semibold tabular-nums text-error"
      />
      <Row
        icon={CalendarCheck}
        label="শ্রমিকদের ফেরত"
        onLabelClick={openHajiraFocus('returned')}
        value={formatBnSigned(labour_return, { showPlus: true })}
        valueClassName="font-semibold tabular-nums text-success"
      />

      <div className="flex items-center gap-2 border-t border-base-content/20 mt-1 pt-2">
        <span className="flex items-center gap-2 flex-1 text-sm sm:text-base font-semibold">
          <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
          ব্যালেন্স
        </span>
        <span className={`text-sm sm:text-base text-right font-semibold tabular-nums ${Number(balance) >= 0 ? 'text-success' : 'text-error'}`}>
          {formatBnNumber(balance)}
        </span>
      </div>
 
    </section>
  )
}
