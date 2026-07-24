import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout.jsx'
import { AppLayout } from '../layouts/AppLayout.jsx'
import { GuestOnly, RequireAuth } from './guards.jsx'
import { paths } from './paths.js'
import { HomePage } from '../pages/home/HomePage.jsx'
import { LoginPage } from '../pages/auth/LoginPage.jsx'
import { RegisterPage } from '../pages/auth/RegisterPage.jsx'
import { RegisterConfirmPage } from '../pages/auth/RegisterConfirmPage.jsx'
import { PasswordResetPage } from '../pages/auth/PasswordResetPage.jsx'
import { PasswordResetConfirmPage } from '../pages/auth/PasswordResetConfirmPage.jsx'
import { ProfilePage } from '../pages/profile/ProfilePage.jsx'
import { ChangePasswordPage } from '../pages/profile/ChangePasswordPage.jsx'
import { PendingOtpRedirect } from './PendingOtpRedirect.jsx'

export const AppRouter = () => (
  <Routes>
    <Route element={<PendingOtpRedirect />}>
      {/* OTP confirm must stay reachable even if logged in */}
      <Route element={<AuthLayout />}>
        <Route path={paths.registerConfirm} element={<RegisterConfirmPage />} />
        <Route
          path={paths.passwordResetConfirm}
          element={<PasswordResetConfirmPage />}
        />
      </Route>

      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path={paths.login} element={<LoginPage />} />
          <Route path={paths.register} element={<RegisterPage />} />
          <Route path={paths.passwordReset} element={<PasswordResetPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path={paths.profile} element={<ProfilePage />} />
          <Route path={paths.changePassword} element={<ChangePasswordPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={paths.home} replace />} />
    </Route>
  </Routes>
)
