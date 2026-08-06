import { api } from './client.js'
import { endpoints } from './endpoints.js'

/** GET /sites — optional filters: is_active, is_closed. */
export const fetchSites = ({ is_active, is_closed } = {}) =>
  api.get(endpoints.sites.list, {
    params: {
      ...(typeof is_active === 'boolean' ? { is_active } : {}),
      ...(typeof is_closed === 'boolean' ? { is_closed } : {}),
    },
  })

/** GET /sites/{id} */
export const fetchSiteDetail = (siteId) =>
  api.get(endpoints.sites.detail(siteId))

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
 * Site cash ledger list.
 * GET /sites/{site_pk}/cash — filters: date, type, billing.
 */
export const fetchSiteCash = (siteId, { date, type, billing } = {}) =>
  api.get(endpoints.sites.cash(siteId), {
    params: {
      ...(date ? { date } : {}),
      ...(type ? { type } : {}),
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

/** DELETE /sites/{site_pk}/cash/{id} */
export const deleteSiteCash = (siteId, cashId) =>
  api.delete(endpoints.sites.cashDetail(siteId, cashId))

/**
 * Private site cash ledger list.
 * GET /sites/{site_pk}/private-cash — filters: date, type, billing.
 */
export const fetchPrivateSiteCash = (
  siteId,
  { date, type, billing } = {},
) =>
  api.get(endpoints.sites.privateCash(siteId), {
    params: {
      ...(date ? { date } : {}),
      ...(type ? { type } : {}),
      ...(billing != null && billing !== '' ? { billing } : {}),
    },
  })

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

/** Billing categories for a site (used as cash `billing` options). */
export const fetchBillingCategories = (siteId, params = {}) =>
  api.get(endpoints.sites.billingCategories(siteId), { params })

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
 * Site labour attendances list.
 * GET /sites/{site_pk}/labour-attendances — filters: date, labour, billing, is_sealed.
 */
export const fetchLabourAttendances = (
  siteId,
  { date, labour, billing, is_sealed } = {},
) =>
  api.get(endpoints.sites.labourAttendances(siteId), {
    params: {
      ...(date ? { date } : {}),
      ...(labour != null && labour !== '' ? { labour } : {}),
      ...(billing != null && billing !== '' ? { billing } : {}),
      ...(typeof is_sealed === 'boolean' ? { is_sealed } : {}),
    },
  })

/** POST /sites/{site_pk}/labour-attendances — bulk create (array body). */
export const createLabourAttendances = (siteId, payload) =>
  api.post(endpoints.sites.labourAttendances(siteId), payload)

/**
 * Site labour payments list.
 * GET /sites/{site_pk}/labour-payments — filters: date, labour, type, is_sealed.
 */
export const fetchLabourPayments = (
  siteId,
  { date, labour, type, is_sealed } = {},
) =>
  api.get(endpoints.sites.labourPayments(siteId), {
    params: {
      ...(date ? { date } : {}),
      ...(labour != null && labour !== '' ? { labour } : {}),
      ...(type ? { type } : {}),
      ...(typeof is_sealed === 'boolean' ? { is_sealed } : {}),
    },
  })

/** POST /sites/{site_pk}/labour-payments — bulk create (array body). */
export const createLabourPayments = (siteId, payload) =>
  api.post(endpoints.sites.labourPayments(siteId), payload)
