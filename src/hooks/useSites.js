import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  buildSiteNameMap,
  fetchAllSitesLookup,
  resolveSiteName,
  SITES_LOOKUP_KEY,
} from '../api/sitesLookup.js'
import { useAuth } from '../providers/AuthProvider.jsx'
import { hasPermission, PERMS } from '../utils/permissions.js'

export {
  SITES_LOOKUP_KEY,
  fetchAllSitesLookup,
  buildSiteNameMap,
  resolveSiteName,
} from '../api/sitesLookup.js'

/**
 * Shared sites lookup — cached for the whole session (staleTime: Infinity).
 * Invalidate via `queryClient.invalidateQueries({ queryKey: ['sites'] })`
 * after create/update/delete (already done on site mutations).
 */
export const useSitesLookup = ({ enabled: enabledOpt } = {}) => {
  const { isAuthenticated, profile } = useAuth()
  const canViewSite = hasPermission(profile, PERMS.viewSite)
  const enabled =
    enabledOpt != null
      ? Boolean(enabledOpt)
      : Boolean(isAuthenticated && canViewSite)

  const query = useQuery({
    queryKey: SITES_LOOKUP_KEY,
    queryFn: fetchAllSitesLookup,
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })

  const sites = query.data ?? []
  const siteNameById = useMemo(() => buildSiteNameMap(sites), [sites])
  const getSiteName = useCallback(
    (id, options) => resolveSiteName(siteNameById, id, options),
    [siteNameById],
  )

  return {
    ...query,
    sites,
    siteNameById,
    getSiteName,
  }
}
