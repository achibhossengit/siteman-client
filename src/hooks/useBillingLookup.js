import { useCallback, useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  billingLookupKey,
  buildBillingNameMap,
  fetchAllBillingLookup,
  filterActiveBilling,
  resolveBillingName,
} from '../api/billingLookup.js'
import { SHOW_BILLING } from '../config/features.js'
import { useAuth } from '../providers/AuthProvider.jsx'

export {
  billingLookupKey,
  fetchAllBillingLookup,
  buildBillingNameMap,
  resolveBillingName,
  filterActiveBilling,
} from '../api/billingLookup.js'

const lookupQueryOptions = (siteId) => ({
  queryKey: billingLookupKey(siteId),
  queryFn: () => fetchAllBillingLookup(siteId),
  staleTime: Infinity,
  gcTime: Infinity,
})

/**
 * Session-cached billing categories for one site (active + inactive).
 * Invalidate via `queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'billing-categories'] })`.
 */
export const useBillingLookup = (siteId, { enabled: enabledOpt } = {}) => {
  const { isAuthenticated } = useAuth()
  const enabled =
    SHOW_BILLING &&
    (enabledOpt != null
      ? Boolean(enabledOpt)
      : Boolean(isAuthenticated && siteId))

  const query = useQuery({
    ...lookupQueryOptions(siteId),
    enabled: Boolean(enabled && siteId),
  })

  const categories = query.data ?? []
  const billingNameById = useMemo(
    () => buildBillingNameMap(categories),
    [categories],
  )
  const activeCategories = useMemo(
    () => filterActiveBilling(categories),
    [categories],
  )
  const getBillingName = useCallback(
    (id, options) => resolveBillingName(billingNameById, id, options),
    [billingNameById],
  )

  return {
    ...query,
    categories,
    activeCategories,
    billingNameById,
    getBillingName,
  }
}

/**
 * Lookup maps for several sites (session records / activity "all sites").
 * Shares the same query keys as `useBillingLookup`.
 */
export const useBillingLookups = (siteIds, { enabled: enabledOpt } = {}) => {
  const { isAuthenticated } = useAuth()
  const uniqueIds = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const id of siteIds ?? []) {
      if (id == null || id === '') continue
      const key = String(id)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
    return out
  }, [siteIds])

  const enabled =
    SHOW_BILLING &&
    (enabledOpt != null ? Boolean(enabledOpt) : Boolean(isAuthenticated))

  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      ...lookupQueryOptions(id),
      enabled: Boolean(enabled && id),
    })),
  })

  const dataUpdatedKey = queries.map((q) => q.dataUpdatedAt ?? 0).join('|')

  const billingNameBySiteId = useMemo(() => {
    const maps = new Map()
    uniqueIds.forEach((id, i) => {
      maps.set(id, buildBillingNameMap(queries[i]?.data ?? []))
    })
    return maps
    // dataUpdatedKey tracks when any site's cached list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueIds, dataUpdatedKey])

  const categoriesBySiteId = useMemo(() => {
    const maps = new Map()
    uniqueIds.forEach((id, i) => {
      maps.set(id, queries[i]?.data ?? [])
    })
    return maps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueIds, dataUpdatedKey])

  const getBillingName = useCallback(
    (siteId, billingId, options) => {
      if (siteId == null || siteId === '') {
        return resolveBillingName(null, billingId, options)
      }
      const map = billingNameBySiteId.get(String(siteId))
      return resolveBillingName(map, billingId, options)
    },
    [billingNameBySiteId],
  )

  const getActiveCategories = useCallback(
    (siteId) => filterActiveBilling(categoriesBySiteId.get(String(siteId))),
    [categoriesBySiteId],
  )

  return {
    billingNameBySiteId,
    categoriesBySiteId,
    getBillingName,
    getActiveCategories,
    queries,
  }
}
