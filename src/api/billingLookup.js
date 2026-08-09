import { fetchBillingCategories } from './sites.js'
import { fetchAllPages } from './pagination.js'
import { NULL_BILLING_LABEL } from '../utils/format.js'

/**
 * Per-site billing category list for id → name lookup.
 * Matches under `['sites', siteId, 'billing-categories']` so panel mutations
 * that invalidate that prefix also refresh this cache.
 */
export const billingLookupKey = (siteId) => [
  'sites',
  String(siteId),
  'billing-categories',
  'lookup',
]

/** All categories (active + inactive), every page. */
export const fetchAllBillingLookup = (siteId) =>
  fetchAllPages(({ page, page_size }) =>
    fetchBillingCategories(siteId, { page, page_size }),
  )

export const buildBillingNameMap = (categories) => {
  const map = new Map()
  for (const cat of categories ?? []) {
    if (cat?.id == null) continue
    map.set(Number(cat.id), cat.name ?? '')
  }
  return map
}

/**
 * Resolve a billing display name from a cached id→name map.
 * Null/empty id → NULL_BILLING_LABEL; unknown id → `#id`.
 */
export const resolveBillingName = (
  billingNameById,
  id,
  { empty = NULL_BILLING_LABEL } = {},
) => {
  if (id == null || id === '') return empty
  const name = billingNameById?.get(Number(id))
  if (name) return name
  return `#${id}`
}

/** Active categories only (for create/edit selects). */
export const filterActiveBilling = (categories) =>
  (categories ?? []).filter((c) => c?.is_active !== false)
