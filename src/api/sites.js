import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { asList, asPage } from './pagination.js'

/** GET /sites — optional filters: is_active, is_closed. Paginated. */
export const fetchSites = ({ is_active, is_closed, page, page_size } = {}) => {
  const params = {
    ...(typeof is_active === 'boolean' ? { is_active } : {}),
    ...(typeof is_closed === 'boolean' ? { is_closed } : {}),
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

/** GET /sites/{id}/active_labour — unpaginated active labours on site. */
export const fetchSiteActiveLabour = (siteId) =>
  api.get(endpoints.sites.activeLabour(siteId)).then((res) => ({
    ...res,
    data: asList(res.data),
  }))

/** POST /sites */
export const createSite = (payload) => api.post(endpoints.sites.list, payload)

/** PATCH /sites/{id} */
export const updateSite = (siteId, payload) =>
  api.patch(endpoints.sites.detail(siteId), payload)

/** DELETE /sites/{id} */
export const deleteSite = (siteId) => api.delete(endpoints.sites.detail(siteId))

/**
 * Day summary for a site.
 * OpenAPI documents 200 as `Site` (incorrect) — live shape is aggregates.
 * Always send `date` (YYYY-MM-DD).
 */
export const fetchDailyReport = (siteId, date) =>
  api.get(endpoints.sites.dailyReports(siteId), {
    params: { date },
  })

/**
 * Site cash ledger list (paginated).
 * GET /sites/{site_pk}/cash — filters: date, type, billing.
 * For a single day use fetchSiteCashByDate instead.
 */
export const fetchSiteCash = (
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
  return api.get(endpoints.sites.cash(siteId), { params }).then((res) => ({
    ...res,
    data:
      page != null || page_size != null ? asPage(res.data) : asList(res.data),
  }))
}

/**
 * Unpaginated cash entries for one day.
 * GET /sites/{site_pk}/cash/{cash_date}
 */
export const fetchSiteCashByDate = (siteId, cashDate) =>
  api.get(endpoints.sites.cashByDate(siteId, cashDate)).then((res) => ({
    ...res,
    data: asList(res.data),
  }))

/**
 * Unpaginated pending (unreviewed) site-cash activity for a date.
 * GET /sites/{site_pk}/cash/{cash_date}/pending_log
 */
export const fetchSiteCashPendingLog = (siteId, cashDate) =>
  api.get(endpoints.sites.cashPendingLog(siteId, cashDate)).then((res) => ({
    ...res,
    data: asList(res.data),
  }))

/** GET /sites/{site_pk}/cash/{id} */
export const fetchSiteCashDetail = (siteId, cashId) =>
  api.get(endpoints.sites.cashDetail(siteId, cashId))

/** POST /sites/{site_pk}/cash */
export const createSiteCash = (siteId, payload) =>
  api.post(endpoints.sites.cash(siteId), payload)

/** PATCH /sites/{site_pk}/cash/{id} */
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

/** Billing categories for a site (paginated). Prefer active-billing for options. */
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
 * Unpaginated active billing categories for option lists.
 * GET /sites/{site_pk}/billing-categories/active-billing
 */
export const fetchActiveBillingCategories = (siteId) =>
  api.get(endpoints.sites.activeBilling(siteId)).then((res) => ({
    ...res,
    data: asList(res.data),
  }))

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
 * Site daily records list (paginated).
 * For a single day use fetchSiteDailyRecordsByDate instead.
 */
export const fetchSiteDailyRecords = (
  siteId,
  { date, labour, billing, is_sealed, page, page_size } = {},
) => {
  const params = {
    ...(date ? { date } : {}),
    ...(labour != null && labour !== '' ? { labour } : {}),
    ...(billing != null && billing !== '' ? { billing } : {}),
    ...(typeof is_sealed === 'boolean' ? { is_sealed } : {}),
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  return api
    .get(endpoints.sites.dailyRecords(siteId), { params })
    .then((res) => ({
      ...res,
      data:
        page != null || page_size != null ? asPage(res.data) : asList(res.data),
    }))
}

/**
 * Unpaginated daily records for one day (হাজিরা).
 * GET /sites/{site_pk}/daily-records/{record_date}
 */
export const fetchSiteDailyRecordsByDate = (siteId, recordDate) =>
  api
    .get(endpoints.sites.dailyRecordsByDate(siteId, recordDate))
    .then((res) => ({
      ...res,
      data: asList(res.data),
    }))

/**
 * Unpaginated pending daily-record activity for a date.
 * GET /sites/{site_pk}/daily-records/{record_date}/pending_log
 */
export const fetchSiteDailyRecordsPendingLog = (siteId, recordDate) =>
  api
    .get(endpoints.sites.dailyRecordsPendingLog(siteId, recordDate))
    .then((res) => ({
      ...res,
      data: asList(res.data),
    }))

/** POST /sites/{site_pk}/daily-records — bulk create (array body). */
export const createSiteDailyRecords = (siteId, payload) =>
  api.post(endpoints.sites.dailyRecords(siteId), payload)
