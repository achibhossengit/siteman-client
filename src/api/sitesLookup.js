import { NULL_SITE_LABEL } from '../utils/format.js'

/**
 * Company site catalog from GET /profile (`sites`), not GET /sites.
 * Shape: [{ id, name, is_active, is_closed }, ...] or an id-keyed object.
 */
export const normalizeSitesCatalog = (sites) => {
  if (Array.isArray(sites)) {
    return sites.filter(
      (site) => site != null && typeof site === 'object' && site.id != null,
    )
  }
  if (sites && typeof sites === 'object') {
    return Object.entries(sites)
      .map(([key, value]) => {
        if (value && typeof value === 'object') {
          return { ...value, id: value.id ?? Number(key) }
        }
        return { id: Number(key), name: String(value ?? '') }
      })
      .filter((site) => site.id != null && !Number.isNaN(Number(site.id)))
  }
  return []
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
