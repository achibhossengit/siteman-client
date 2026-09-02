/**
 * Company subscription caps from GET /profile (`profile.company`).
 * Limits apply to active (non-closed) resources.
 */

const LIMIT_KEYS = {
  user: ['active_user_limit', 'user_limit'],
  labour: ['active_labour_limit', 'labour_limit'],
  site: ['active_site_limit', 'site_limit'],
}

const asCompany = (profile) => {
  const company = profile?.company
  return company && typeof company === 'object' ? company : null
}

const asLimit = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** @returns {number | null} */
export const getCompanyLimit = (profile, kind) => {
  const company = asCompany(profile)
  if (!company) return null
  for (const key of LIMIT_KEYS[kind] ?? []) {
    const n = asLimit(company[key])
    if (n != null) return n
  }
  return null
}

export const isSubscriptionLimitReached = (used, limit) =>
  limit != null && Number(used) >= limit
