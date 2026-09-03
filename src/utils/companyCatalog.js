import { NULL_SITE_LABEL } from './format.js'

export const GROUP_TYPE = {
  platform: 'platform',
  tenantSystem: 'tenant_system',
  tenant: 'tenant',
}

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
 * Company groups: `{ id, name, type }` (`platform` | `tenant_system` | `tenant`).
 * Only `tenant` groups are assignable on user create/update.
 */
export const CompanyCatalog = {
  ids,
  groups: (company) => namedList(company?.groups),
  assignableGroups: (company) =>
    CompanyCatalog.groups(company).filter(
      (group) => group.type === GROUP_TYPE.tenant,
    ),
  sites: (company) => namedList(company?.sites),
  groupNameMap: (company) => nameMap(CompanyCatalog.groups(company)),
  siteNameMap: (company) => nameMap(CompanyCatalog.sites(company)),
  groupName: (company, id, empty = '—') =>
    resolveName(CompanyCatalog.groupNameMap(company), id, empty),
  siteName: (company, id, empty = NULL_SITE_LABEL) =>
    resolveName(CompanyCatalog.siteNameMap(company), id, empty),
  assignedGroupIds: (user) => ids(user?.allowed_groups ?? user?.groups),
  assignedSiteIds: (user) => ids(user?.allowed_sites ?? user?.sites),
  assignedAssignableGroupIds: (user, company) => {
    const assignable = new Set(
      CompanyCatalog.assignableGroups(company).map((group) => Number(group.id)),
    )
    return CompanyCatalog.assignedGroupIds(user).filter((id) =>
      assignable.has(id),
    )
  },
}
