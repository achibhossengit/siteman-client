import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CalendarCheck, Wallet } from 'lucide-react'
import {
  fetchDailyReport,
  fetchDailyReportDetails,
} from '../../api/sites.js'
import { fetchAllPages } from '../../api/pagination.js'
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
  parseIsoDate,
} from '../../utils/dateRange.js'

const DAY_PAGE_SIZE = 100

/** Same header band as the Hajira and Cash tables. */
const HEAD_BG =
  '!bg-[color-mix(in_oklab,var(--color-neutral),var(--color-base-300)_35%)] !text-neutral-content'
const HEAD_BAR = `${HEAD_BG} px-2 py-1.5 text-sm font-semibold leading-tight sm:py-2`

const amountTone = (value) =>
  Number(value) >= 0 ? 'text-success' : 'text-error'

const moneyClass = (value, tone) =>
  Number(value) ? tone : 'text-base-content/35'

const formatDayLabel = (iso, withYear) => {
  const d = parseIsoDate(iso)
  if (!d) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: '2-digit' } : {}),
  }).format(d)
}

const COLUMNS = [
  { key: 'deposit', label: 'জমা', tone: 'text-success' },
  { key: 'withdrawal', label: 'উত্তোলন', tone: 'text-warning' },
  { key: 'site_cost', label: 'সাইট খরচ', tone: 'text-error' },
  { key: 'labour_payment', label: 'শ্রমিকদের দেওয়া', tone: 'text-error' },
  { key: 'labour_return', label: 'শ্রমিকদের ফেরত', tone: 'text-success' },
  { key: 'balance', label: 'ব্যালেন্স', tone: 'balance' },
]

const columnClass = (col, value) =>
  col.tone === 'balance' ? amountTone(value) : moneyClass(value, col.tone)

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

const DetailTable = ({ days, total, withYear, onBack }) => (
  <table className="table table-sm w-max min-w-full border-separate border-spacing-0 text-sm [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-sm [&_th]:font-semibold [&_th]:leading-tight sm:[&_th]:py-2 [&_td]:px-2 [&_td]:py-1.5">
    <thead>
      <tr>
        <th
          className={`sticky top-0 left-0 z-30 whitespace-nowrap text-left ${HEAD_BG}`}
        >
          তারিখ
        </th>
        {COLUMNS.map((col) => (
          <th
            key={col.key}
            className={`sticky top-0 z-20 text-right whitespace-nowrap ${HEAD_BG}`}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {days.map((day, index) => {
        const rowBg = index % 2 === 0 ? '!bg-base-100' : '!bg-base-200'
        return (
          <tr key={day.date}>
            <td
              className={`sticky left-0 z-10 whitespace-nowrap font-medium ${rowBg}`}
            >
              {formatDayLabel(day.date, withYear)}
            </td>
            {COLUMNS.map((col) => (
              <td
                key={col.key}
                className={`text-right tabular-nums whitespace-nowrap ${rowBg} ${columnClass(col, day[col.key])}`}
              >
                {formatBnNumber(day[col.key])}
              </td>
            ))}
          </tr>
        )
      })}
    </tbody>
    <tfoot>
      <tr
        role="button"
        tabIndex={0}
        aria-label="সর্বমোট"
        className="cursor-pointer font-semibold"
        onClick={onBack}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onBack()
        }}
      >
        <td className="sticky bottom-0 left-0 z-30 whitespace-nowrap !bg-base-300 underline underline-offset-2">
          সর্বমোট
        </td>
        {COLUMNS.map((col) => (
          <td
            key={col.key}
            className={`sticky bottom-0 z-20 !bg-base-300 text-right tabular-nums whitespace-nowrap ${columnClass(col, total[col.key])}`}
          >
            {formatBnNumber(total[col.key])}
          </td>
        ))}
      </tr>
    </tfoot>
  </table>
)

export const BalancePage = () => {
  const { date, dateEnd, siteId } = useOutletContext()
  const navigate = useNavigate()
  const isRange = isMultiDaySelection(date, dateEnd)
  const reportParams = useMemo(
    () => dateFilterParams(date, dateEnd),
    [date, dateEnd],
  )
  const isCalendarRange = Boolean(reportParams.date__gte && reportParams.date__lte)
  const isSingleDay = Boolean(reportParams.date)
  const [view, setView] = useState('total')

  useEffect(() => {
    if (isSingleDay) setView('total')
  }, [isSingleDay])

  const query = useQuery({
    queryKey: ['sites', siteId, 'daily-reports', 'summary', reportParams],
    queryFn: async () => {
      const { data } = await fetchDailyReport(siteId, reportParams)
      return data
    },
    enabled: Boolean(siteId && date),
    placeholderData: (previous) =>
      previous && typeof previous === 'object' && 'balance' in previous
        ? previous
        : undefined,
  })

  const detailQuery = useQuery({
    queryKey: ['sites', siteId, 'daily-reports', 'details', reportParams],
    queryFn: () =>
      fetchAllPages(
        ({ page, page_size }) =>
          fetchDailyReportDetails(siteId, {
            ...(isCalendarRange
              ? {
                  date__gte: reportParams.date__gte,
                  date__lte: reportParams.date__lte,
                }
              : {}),
            page,
            page_size,
          }),
        { page_size: DAY_PAGE_SIZE },
      ),
    enabled: Boolean(siteId && date && !isSingleDay && view === 'detail'),
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

  const report =
    query.data && typeof query.data === 'object' && 'balance' in query.data
      ? query.data
      : null
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

  const days = Array.isArray(detailQuery.data)
    ? [...detailQuery.data].sort((a, b) =>
        String(a.date).localeCompare(String(b.date)),
      )
    : []
  const firstDay = days[0]?.date
  const lastDay = days.at(-1)?.date
  const spansYears = isCalendarRange
    ? reportParams.date__gte.slice(0, 4) !== reportParams.date__lte.slice(0, 4)
    : Boolean(firstDay && lastDay && firstDay.slice(0, 4) !== lastDay.slice(0, 4))
  const showDetail = !isSingleDay && view === 'detail'

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
    <section
      className={`flex-1 min-h-0 flex flex-col px-2 pb-2 ${showDetail ? 'overflow-hidden' : 'overflow-y-auto'}`}
    >
      {showDetail ? (
        detailQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : detailQuery.isError ? (
          <div className="flex flex-col gap-2">
            <ApiErrorAlert error={parseApiError(detailQuery.error)} />
            <button
              type="button"
              className="self-start text-sm font-semibold underline underline-offset-2"
              onClick={() => setView('total')}
            >
              সর্বমোট
            </button>
          </div>
        ) : (
          <div className="-mx-2 min-h-0 flex-1 overflow-auto">
            <DetailTable
              days={days}
              total={report}
              withYear={spansYears}
              onBack={() => setView('total')}
            />
          </div>
        )
      ) : (
        <>
          <div
            role="tablist"
            aria-label="হিসাবের ধরন"
            className={`-mx-2 mb-2 flex shrink-0 items-center justify-between ${HEAD_BAR}`}
          >
            <span role="tab" aria-selected="true" className="text-neutral-content">
              সর্বমোট
            </span>
            {!isSingleDay ? (
              <button
                type="button"
                role="tab"
                aria-selected="false"
                className="text-neutral-content/55"
                onClick={() => setView('detail')}
              >
                বিস্তারিত
              </button>
            ) : null}
          </div>
          <Row
            icon={Banknote}
            label="আগের ব্যালেন্স"
            value={formatBnNumber(previous_balance)}
            valueClassName={`font-semibold tabular-nums ${amountTone(previous_balance)}`}
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
            valueClassName={`font-semibold tabular-nums ${amountTone(creditTotal)}`}
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
            <span className={`text-sm sm:text-base text-right font-semibold tabular-nums ${amountTone(balance)}`}>
              {formatBnNumber(balance)}
            </span>
          </div>
        </>
      )}
    </section>
  )
}
