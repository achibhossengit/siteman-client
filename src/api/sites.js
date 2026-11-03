import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { asList, asPage, fetchAllPages } from './pagination.js'

/** GET /sites — optional filters: is_active, is_closed, search. Paginated. */
export const fetchSites = ({
  is_active,
  is_closed,
  search,
  page,
  page_size,
} = {}) => {
  const params = {
    ...(typeof is_active === 'boolean' ? { is_active } : {}),
    ...(typeof is_closed === 'boolean' ? { is_closed } : {}),
    ...(search ? { search } : {}),
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  return api.get(endpoints.sites.list, { params }).then((res) => ({
    ...res,
    data:
      page != null || page_size != null ? asPage(res.data) : asList(res.data),
  }))
}

/** GET /sites/{id} */
export const fetchSiteDetail = (siteId) =>
  api.get(endpoints.sites.detail(siteId))

/** POST /sites */
export const createSite = (payload) => api.post(endpoints.sites.list, payload)

/** PATCH /sites/{id} */
export const updateSite = (siteId, payload) =>
  api.patch(endpoints.sites.detail(siteId), payload)

/** DELETE /sites/{id} — confirm with own password. */
export const deleteSite = (siteId, { password } = {}) =>
  api.delete(endpoints.sites.detail(siteId), {
    data: { password },
  })

/** Server cap for a daily-report details page. */
const DAILY_REPORT_MAX_PAGE_SIZE = 100

/**
 * GET /sites/{id}/daily-reports — summary only, not paginated.
 * Omit dates for the all-time site summary, `date` for one day, or
 * `date__gte` + `date__lte` for the inclusive range aggregate.
 * Do not send `date` together with the range params.
 *
 * Flat object: site, present_count, labour_payment, labour_return, deposit,
 * withdrawal, site_cost, total_cost, remaining, previous_balance, balance
 * (plus total_salary / extra_earnings when permitted).
 */
export const fetchDailyReport = (
  siteId,
  { date, date__gte, date__lte } = {},
) => {
  const range = Boolean(date__gte && date__lte)
  const params = range
    ? { date__gte, date__lte }
    : date
      ? { date }
      : {}
  return api.get(endpoints.sites.dailyReports(siteId), { params })
}

/**
 * GET /sites/{id}/daily-reports/details — one row per calendar day, oldest
 * first. Empty days are zeros. No aggregate `total`.
 * `date__gte` and `date__lte` together select an inclusive range. Omit both
 * for every day from the site's first activity through its last. Never send
 * `date`, and never send only one bound.
 * `page` defaults to 1; `page_size` defaults to 50, max 100.
 * A site with no activity and no dates returns `{ count: 0, results: [] }`.
 */
export const fetchDailyReportDetails = (
  siteId,
  { date__gte, date__lte, page, page_size } = {},
) => {
  const hasGte = Boolean(date__gte)
  const hasLte = Boolean(date__lte)
  if (hasGte !== hasLte) {
    return Promise.reject(
      new Error('date__gte and date__lte must both be set, or both omitted'),
    )
  }
  const size = Number(page_size)
  const params = {
    ...(hasGte ? { date__gte, date__lte } : {}),
    ...(page != null ? { page } : {}),
    ...(Number.isFinite(size)
      ? {
          page_size: Math.min(
            Math.max(1, Math.trunc(size)),
            DAILY_REPORT_MAX_PAGE_SIZE,
          ),
        }
      : {}),
  }
  return api
    .get(endpoints.sites.dailyReportDetails(siteId), { params })
    .then((res) => ({
      ...res,
      data: asPage(res.data),
    }))
}

/**
 * Site cash ledger list (paginated).
 * GET /sites/{site_pk}/cash — filters: date, date__gte, date__lte, type, billing.
 * Page payload may include `totals` for the filtered window.
 */
export const fetchSiteCash = (
  siteId,
  { date, date__gte, date__lte, type, billing, page, page_size } = {},
) => {
  const params = {
    ...(date ? { date } : {}),
    ...(date__gte ? { date__gte } : {}),
    ...(date__lte ? { date__lte } : {}),
    ...(type ? { type } : {}),
    ...(billing != null && billing !== '' ? { billing } : {}),
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  return api.get(endpoints.sites.cash(siteId), { params }).then((res) => ({
    ...res,
    data:
      page != null || page_size != null ? asPage(res.data) : asList(res.data),
  }))
}

/** All cash rows for one day (walks pagination). */
export const fetchSiteCashByDate = async (siteId, cashDate) => {
  const data = await fetchAllPages(({ page, page_size }) =>
    fetchSiteCash(siteId, { date: cashDate, page, page_size }),
  )
  return { data }
}

/** GET /sites/{site_pk}/cash/{id} */
export const fetchSiteCashDetail = (siteId, cashId) =>
  api.get(endpoints.sites.cashDetail(siteId, cashId))

/** POST /sites/{site_pk}/cash — JSON, or multipart when attaching `file`. */
export const createSiteCash = (siteId, payload) =>
  api.post(endpoints.sites.cash(siteId), payload)

/** PATCH /sites/{site_pk}/cash/{id} — JSON, or multipart when attaching `file`. */
export const updateSiteCash = (siteId, cashId, payload) =>
  api.patch(endpoints.sites.cashDetail(siteId, cashId), payload)

/** DELETE /sites/{site_pk}/cash/{id} */
export const deleteSiteCash = (siteId, cashId) =>
  api.delete(endpoints.sites.cashDetail(siteId, cashId))

/**
 * Private site cash ledger list (paginated).
 * GET /sites/{site_pk}/private-cash — filters: date, type, billing.
 */
export const fetchPrivateSiteCash = (
  siteId,
  { date, type, billing, page, page_size } = {},
) => {
  const params = {
    ...(date ? { date } : {}),
    ...(type ? { type } : {}),
    ...(billing != null && billing !== '' ? { billing } : {}),
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  return api
    .get(endpoints.sites.privateCash(siteId), { params })
    .then((res) => ({
      ...res,
      data:
        page != null || page_size != null ? asPage(res.data) : asList(res.data),
    }))
}

/** GET /sites/{site_pk}/private-cash/{id} */
export const fetchPrivateSiteCashDetail = (siteId, id) =>
  api.get(endpoints.sites.privateCashDetail(siteId, id))

/** POST /sites/{site_pk}/private-cash */
export const createPrivateSiteCash = (siteId, payload) =>
  api.post(endpoints.sites.privateCash(siteId), payload)

/** PATCH /sites/{site_pk}/private-cash/{id} */
export const updatePrivateSiteCash = (siteId, id, payload) =>
  api.patch(endpoints.sites.privateCashDetail(siteId, id), payload)

/** DELETE /sites/{site_pk}/private-cash/{id} */
export const deletePrivateSiteCash = (siteId, id) =>
  api.delete(endpoints.sites.privateCashDetail(siteId, id))

/** Billing categories for a site (paginated). */
export const fetchBillingCategories = (
  siteId,
  { page, page_size, ...filters } = {},
) => {
  const params = {
    ...filters,
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  return api
    .get(endpoints.sites.billingCategories(siteId), { params })
    .then((res) => ({
      ...res,
      data:
        page != null || page_size != null ? asPage(res.data) : asList(res.data),
    }))
}

/**
 * Active billing categories for option lists.
 * GET /sites/{site_pk}/billing-categories?is_active=true (all pages).
 */
export const fetchActiveBillingCategories = async (siteId) => {
  const data = await fetchAllPages(({ page, page_size }) =>
    fetchBillingCategories(siteId, { is_active: true, page, page_size }),
  )
  return { data }
}

/** GET /sites/{site_pk}/billing-categories/{id} */
export const fetchBillingCategoryDetail = (siteId, id) =>
  api.get(endpoints.sites.billingCategoryDetail(siteId, id))

/** POST /sites/{site_pk}/billing-categories */
export const createBillingCategory = (siteId, payload) =>
  api.post(endpoints.sites.billingCategories(siteId), payload)

/** PATCH /sites/{site_pk}/billing-categories/{id} */
export const updateBillingCategory = (siteId, id, payload) =>
  api.patch(endpoints.sites.billingCategoryDetail(siteId, id), payload)

/** DELETE /sites/{site_pk}/billing-categories/{id} */
export const deleteBillingCategory = (siteId, id) =>
  api.delete(endpoints.sites.billingCategoryDetail(siteId, id))

/**
 * Site hajira roster (unpaginated array).
 * GET /sites/{site_pk}/daily-records — `date` (defaults to today) or
 * `date__gte` / `date__lte`. Each item is `{ labour, records, totals }`.
 * Windows longer than one month omit individual records (totals only).
 */
export const fetchSiteDailyRecords = (
  siteId,
  { date, date__gte, date__lte } = {},
) => {
  const params = {
    ...(date ? { date } : {}),
    ...(date__gte ? { date__gte } : {}),
    ...(date__lte ? { date__lte } : {}),
  }
  return api.get(endpoints.sites.dailyRecords(siteId), { params }).then((res) => ({
    ...res,
    data: asList(res.data),
  }))
}

/** Full roster for the given date filter. */
export const fetchAllSiteDailyRecords = (siteId, filters = {}) =>
  fetchSiteDailyRecords(siteId, filters)

/** Hajira roster for one day — `{ labour, records, totals }` list. */
export const fetchSiteDailyRecordsByDate = (siteId, recordDate) =>
  fetchSiteDailyRecords(siteId, { date: recordDate })

/** POST /sites/{site_pk}/daily-records — bulk create (array body). */
export const createSiteDailyRecords = (siteId, payload) =>
  api.post(endpoints.sites.dailyRecords(siteId), payload)
