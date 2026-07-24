/**
 * Live GET /sites/{id}/daily-reports?date= payload (OpenAPI types 200 as Site — wrong).
 *
 * {
 *   site, date, present_count, labour_payment, labour_return,
 *   deposit, withdrawal, site_cost, total_cost, remaining,
 *   previous_balance, balance, labour_session_count,
 *   total_salary, extra_earnings
 * }
 */
const num = (v) => {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const normalizeDailyReport = (raw) => {
  if (!raw || typeof raw !== 'object') return null

  return {
    site: raw.site ?? null,
    date: raw.date ?? null,
    presentCount: num(raw.present_count),
    labourPayment: num(raw.labour_payment),
    labourReturn: num(raw.labour_return),
    deposit: num(raw.deposit),
    withdrawal: num(raw.withdrawal),
    siteCost: num(raw.site_cost),
    totalCost: num(raw.total_cost),
    remaining: num(raw.remaining),
    previousBalance: num(raw.previous_balance),
    balance: num(raw.balance),
    labourSessionCount: num(raw.labour_session_count),
    totalSalary: num(raw.total_salary),
    extraEarnings: num(raw.extra_earnings),
  }
}
