import { api } from './client.js'
import { endpoints } from './endpoints.js'

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
 * Site cash ledger list.
 * GET /sites/{site_pk}/cash — filters: date, type, category, billing.
 */
export const fetchSiteCash = (siteId, { date, type, category, billing } = {}) =>
  api.get(endpoints.sites.cash(siteId), {
    params: {
      ...(date ? { date } : {}),
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
      ...(billing != null && billing !== '' ? { billing } : {}),
    },
  })

/** GET /sites/{site_pk}/cash/{id} */
export const fetchSiteCashDetail = (siteId, cashId) =>
  api.get(endpoints.sites.cashDetail(siteId, cashId))

/** POST /sites/{site_pk}/cash */
export const createSiteCash = (siteId, payload) =>
  api.post(endpoints.sites.cash(siteId), payload)

/** PATCH /sites/{site_pk}/cash/{id} */
export const updateSiteCash = (siteId, cashId, payload) =>
  api.patch(endpoints.sites.cashDetail(siteId, cashId), payload)

/** Billing categories for a site (used as cash `billing` options). */
export const fetchBillingCategories = (siteId, params = {}) =>
  api.get(endpoints.sites.billingCategories(siteId), { params })
