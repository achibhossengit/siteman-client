import { useAuth } from '../../app/providers/AuthProvider.jsx'
import {
  canListAllCompanySites,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from '../lib/permissions.js'

export const usePermissions = () => {
  const { profile } = useAuth()

  return {
    profile,
    can: (codename) => hasPermission(profile, codename),
    canAny: (codenames) => hasAnyPermission(profile, codenames),
    canAll: (codenames) => hasAllPermissions(profile, codenames),
    canListAllCompanySites: () => canListAllCompanySites(profile),
    isCompanyAdmin: Boolean(profile?.is_companyadmin),
  }
}
