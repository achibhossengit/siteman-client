/**
 * Company subscription caps from GET /company.
 * Limits apply to active (non-closed) resources.
 */

import { isIsoDate, parseIsoDate, todayIso } from './dateRange.js'

/** Warn when expiry is today through this many days away. */
const EXPIRY_WARN_DAYS = 3

const LIMIT_KEYS = {
  user: ['active_user_limit', 'user_limit'],
  labour: ['active_labour_limit', 'labour_limit'],
  site: ['site_limit', 'active_site_limit'],
}

const asCompany = (company) =>
  company && typeof company === 'object' ? company : null

const asLimit = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** @returns {number | null} */
export const getCompanyLimit = (company, kind) => {
  const c = asCompany(company)
  if (!c) return null
  for (const key of LIMIT_KEYS[kind] ?? []) {
    const n = asLimit(c[key])
    if (n != null) return n
  }
  return null
}

export const isSubscriptionLimitReached = (used, limit) =>
  limit != null && Number(used) >= limit

/** Shown instead of the company-settings update CTA when the viewer is not company admin. */
export const SUBSCRIPTION_UPDATE_ASK_ADMIN =
  'আপডেট করতে কোম্পানি অ্যাডমিনের সাথে যোগাযোগ করুন।'

/** Calendar date from `company.paid_until` (`YYYY-MM-DD` or datetime). */
export const paidUntilIso = (company) => {
  const raw = asCompany(company)?.paid_until
  if (raw == null || raw === '') return null
  const datePart = String(raw).trim().slice(0, 10)
  return isIsoDate(datePart) ? datePart : null
}

const daysUntilIso = (iso, today) => {
  const from = parseIsoDate(today)
  const to = parseIsoDate(iso)
  if (!from || !to) return null
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/**
 * Popup when expired, or expiring within 7 days (inclusive of today).
 * @returns {{ kind: 'expired' | 'expiring', paidUntil: string } | null}
 */
export const getSubscriptionExpiryStatus = (company, today = todayIso()) => {
  const paidUntil = paidUntilIso(company)
  if (!paidUntil) return null
  const days = daysUntilIso(paidUntil, today)
  if (days == null) return null
  if (days < 0) return { kind: 'expired', paidUntil }
  if (days <= EXPIRY_WARN_DAYS) return { kind: 'expiring', paidUntil }
  return null
}
