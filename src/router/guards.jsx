import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { SubscriptionExpiryPopup } from '../components/SubscriptionExpiryPopup.jsx'
import { useAuth } from '../providers/AuthProvider.jsx'
import { isCompanyAdmin } from '../utils/permissions.js'
import { paths } from './paths.js'

export const RequireAuth = () => {
  const { isAuthenticated, bootstrapping } = useAuth()
  const location = useLocation()

  if (bootstrapping) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={paths.login} replace state={{ from: location }} />
  }

  return (
    <>
      <SubscriptionExpiryPopup />
      <Outlet />
    </>
  )
}

export const GuestOnly = () => {
  const { isAuthenticated, bootstrapping } = useAuth()

  if (bootstrapping) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={paths.home} replace />
  }

  return <Outlet />
}

export const RequireCompanyAdmin = () => {
  const { profile } = useAuth()
  const outletContext = useOutletContext()

  if (!isCompanyAdmin(profile)) {
    return <Navigate to={paths.others} replace />
  }

  return <Outlet context={outletContext} />
}
