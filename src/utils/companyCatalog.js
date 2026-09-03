import { NULL_SITE_LABEL } from './format.js'

const toId = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'object') return toId(value.id)
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

const ids = (values) =>
  (Array.isArray(values) ? values : []).map(toId).filter((id) => id != null)

const namedList = (raw) => {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item) =>
      item && typeof item === 'object' && item.id != null && item.name != null,
  )
}

const nameMap = (items) => {
  const map = new Map()
  for (const item of items) {
    map.set(Number(item.id), String(item.name))
  }
  return map
}

const resolveName = (map, id, fallback) => {
  if (id == null || id === '') return fallback
  return map.get(Number(id)) || `#${id}`
}

/**
 * Resolve GET /users/{id} group/site ids against GET /company catalogs.
 */
export const CompanyCatalog = {
  ids,
  groups: (company) => namedList(company?.groups),
  sites: (company) => namedList(company?.sites),
  groupNameMap: (company) => nameMap(CompanyCatalog.groups(company)),
  siteNameMap: (company) => nameMap(CompanyCatalog.sites(company)),
  groupName: (company, id, empty = '—') =>
    resolveName(CompanyCatalog.groupNameMap(company), id, empty),
  siteName: (company, id, empty = NULL_SITE_LABEL) =>
    resolveName(CompanyCatalog.siteNameMap(company), id, empty),
  assignedGroupIds: (user) => ids(user?.allowed_groups ?? user?.groups),
  assignedSiteIds: (user) => ids(user?.allowed_sites ?? user?.sites),
  groupNamesFromIds: (company, values) => {
    const map = CompanyCatalog.groupNameMap(company)
    return ids(values)
      .map((id) => map.get(id))
      .filter(Boolean)
  },
}
