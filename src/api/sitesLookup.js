import { fetchSites } from './sites.js'
import { NULL_SITE_LABEL } from '../utils/format.js'

/** Session-wide site list for id → name lookup (not the paginated Sites page). */
export const SITES_LOOKUP_KEY = ['sites', 'lookup']

const LOOKUP_PAGE_SIZE = 100
const LOOKUP_MAX_PAGES = 50

/** Fetch every page of GET /sites for the lookup cache. */
export const fetchAllSitesLookup = async () => {
  const results = []
  let page = 1
  for (;;) {
    const { data } = await fetchSites({
      page,
      page_size: LOOKUP_PAGE_SIZE,
    })
    const chunk = Array.isArray(data?.results) ? data.results : []
    results.push(...chunk)
    if (!data?.next) break
    page += 1
    if (page > LOOKUP_MAX_PAGES) break
  }
  return results
}

export const buildSiteNameMap = (sites) => {
  const map = new Map()
  for (const site of sites ?? []) {
    if (site?.id == null) continue
    map.set(Number(site.id), site.name ?? '')
  }
  return map
}

/**
 * Resolve a site display name from a cached id→name map.
 * Null/empty id → NULL_SITE_LABEL; unknown id → `#id`.
 */
export const resolveSiteName = (
  siteNameById,
  id,
  { empty = NULL_SITE_LABEL } = {},
) => {
  if (id == null || id === '') return empty
  const name = siteNameById?.get(Number(id))
  if (name) return name
  return `#${id}`
}
