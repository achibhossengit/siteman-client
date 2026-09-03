import { useCallback, useMemo } from 'react'
import {
  buildSiteNameMap,
  normalizeSitesCatalog,
  resolveSiteName,
} from '../api/sitesLookup.js'
import { profileAllowedSiteIds } from '../api/types/user.js'
import { useAuth } from '../providers/AuthProvider.jsx'

export {
  buildSiteNameMap,
  normalizeSitesCatalog,
  resolveSiteName,
} from '../api/sitesLookup.js'

/**
 * Company site catalog from GET /company (`sites`).
 * Refresh by calling `refreshCompany()` after site create/update/delete.
 */
export const useSitesLookup = ({ enabled: enabledOpt } = {}) => {
  const { isAuthenticated, company } = useAuth()
  const enabled =
    enabledOpt != null
      ? Boolean(enabledOpt)
      : Boolean(isAuthenticated && company)

  const sites = useMemo(() => {
    if (!enabled) return []
    return normalizeSitesCatalog(company?.sites)
  }, [enabled, company?.sites])

  const siteNameById = useMemo(() => buildSiteNameMap(sites), [sites])
  const getSiteName = useCallback(
    (id, options) => resolveSiteName(siteNameById, id, options),
    [siteNameById],
  )

  const isLoading = Boolean(enabled && isAuthenticated && !company)

  return {
    sites,
    siteNameById,
    getSiteName,
    data: sites,
    isLoading,
    isPending: isLoading,
    isFetching: false,
    isError: false,
    isSuccess: Boolean(enabled && company),
  }
}

/**
 * Profile `allowed_sites` joined with the company catalog (`company.sites`).
 * Company admins receive every company site id in `allowed_sites`.
 */
export const useAssignedSites = ({
  includeClosed = false,
  enabled,
} = {}) => {
  const { profile } = useAuth()
  const lookup = useSitesLookup({ enabled })

  const assignedIds = useMemo(
    () => (enabled === false ? [] : profileAllowedSiteIds(profile)),
    [enabled, profile],
  )

  const assignedIdSet = useMemo(
    () => new Set(assignedIds.map(Number)),
    [assignedIds],
  )

  const assignedSites = useMemo(() => {
    if (enabled === false) return []
    const raw = Array.isArray(profile?.allowed_sites)
      ? profile.allowed_sites
      : []
    const fromAllowed = raw.filter(
      (site) => site && typeof site === 'object' && site.id != null,
    )
    const source =
      fromAllowed.length > 0
        ? fromAllowed
        : lookup.sites.filter((site) => assignedIdSet.has(Number(site.id)))
    if (includeClosed) return source
    return source.filter((site) => !site.is_closed)
  }, [
    enabled,
    profile?.allowed_sites,
    lookup.sites,
    assignedIdSet,
    includeClosed,
  ])

  return {
    ...lookup,
    assignedIds,
    assignedIdSet,
    assignedSites,
  }
}
