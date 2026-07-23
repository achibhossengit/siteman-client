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
