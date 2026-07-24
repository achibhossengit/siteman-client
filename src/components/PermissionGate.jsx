import { usePermissions } from '../hooks/usePermissions.js'

/**
 * Soft UI gate on profile.permissions codenames.
 * Do not gate solely on group names.
 */
export const PermissionGate = ({
  permission,
  anyOf,
  allOf,
  fallback = null,
  children,
}) => {
  const { can, canAny, canAll } = usePermissions()

  let allowed = true
  if (permission) allowed = can(permission)
  if (anyOf?.length) allowed = canAny(anyOf)
  if (allOf?.length) allowed = canAll(allOf)

  if (!allowed) return fallback
  return children
}
