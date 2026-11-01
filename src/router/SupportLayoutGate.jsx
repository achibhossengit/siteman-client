import { AuthLayout } from '../layouts/AuthLayout.jsx'
import { DetailLayout } from '../layouts/DetailLayout.jsx'
import { useAuth } from '../providers/AuthProvider.jsx'

/** Same support page: DetailLayout when logged in, AuthLayout when logged out. */
export const SupportLayoutGate = () => {
  const { isAuthenticated, bootstrapping } = useAuth()

  if (bootstrapping) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  return isAuthenticated ? <DetailLayout /> : <AuthLayout />
}
