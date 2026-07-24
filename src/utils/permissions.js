/** Common Django-style permission codenames used for soft UI gates. */
export const PERMS = {
  viewUser: 'users.view_user',
  addUser: 'users.add_user',
  changeUser: 'users.change_user',
  viewSite: 'sites.view_site',
  addSite: 'sites.add_site',
  changeSite: 'sites.change_site',
  viewLabour: 'labours.view_labour',
  addLabour: 'labours.add_labour',
  changeLabour: 'labours.change_labour',
}

export const ROLE_NAMES = {
  companyAdmin: 'Company Admin',
  siteManager: 'Site Manager',
  siteAuditor: 'Site Auditor',
}

/** Never gate solely on group name strings — use permission codenames. */

export const hasPermission = (profile, codename) => {
  if (!profile || !codename) return false
  const list = profile.permissions
  return Array.isArray(list) && list.includes(codename)
}

export const hasAnyPermission = (profile, codenames = []) =>
  codenames.some((code) => hasPermission(profile, code))

export const hasAllPermissions = (profile, codenames = []) =>
  codenames.every((code) => hasPermission(profile, code))

/**
 * is_companyadmin bypasses site-assignment checks only — not model permissions.
 */
export const canListAllCompanySites = (profile) =>
  Boolean(profile?.is_companyadmin)
