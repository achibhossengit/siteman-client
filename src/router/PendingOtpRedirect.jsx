import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { paths } from './paths.js'
import { getPendingOtpKind } from '../utils/otpSession.js'

/**
 * If an OTP ticket is pending, force the confirm page until cancelled or completed.
 */
export const PendingOtpRedirect = () => {
  const location = useLocation()
  const kind = getPendingOtpKind()

  if (kind === 'register' && location.pathname !== paths.registerConfirm) {
    return <Navigate to={paths.registerConfirm} replace />
  }

  if (
    kind === 'passwordReset' &&
    location.pathname !== paths.passwordResetConfirm
  ) {
    return <Navigate to={paths.passwordResetConfirm} replace />
  }

  return <Outlet />
}
