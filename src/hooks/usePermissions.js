import { useAuth } from '../providers/AuthProvider.jsx'
import {
  isCompanyAdmin,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from '../utils/permissions.js'

export const usePermissions = () => {
  const { profile } = useAuth()

  return {
    profile,
    can: (codename) => hasPermission(profile, codename),
    canAny: (codenames) => hasAnyPermission(profile, codenames),
    canAll: (codenames) => hasAllPermissions(profile, codenames),
    isCompanyAdmin: () => isCompanyAdmin(profile),
    isCompanyAdmin: Boolean(profile?.is_companyadmin),
  }
}
