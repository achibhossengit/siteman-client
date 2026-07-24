import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout.jsx'
import { AppLayout } from '../layouts/AppLayout.jsx'
import { SiteScopedLayout } from '../layouts/SiteScopedLayout.jsx'
import { LabourDetailLayout } from '../layouts/LabourDetailLayout.jsx'
import { GuestOnly, RequireAuth } from './guards.jsx'
import { paths } from './paths.js'
import {
  LabourOverviewPage,
  LabourSectionPage,
  LaboursPage,
  SiteLedgerPage,
  SitesPage,
  UsersPage,
} from './placeholders.jsx'
import { HomePage } from '../pages/home/HomePage.jsx'
import { LoginPage } from '../pages/auth/LoginPage.jsx'
import { RegisterPage } from '../pages/auth/RegisterPage.jsx'
import { RegisterConfirmPage } from '../pages/auth/RegisterConfirmPage.jsx'
import { PasswordResetPage } from '../pages/auth/PasswordResetPage.jsx'
import { PasswordResetConfirmPage } from '../pages/auth/PasswordResetConfirmPage.jsx'
import { ProfilePage } from '../pages/profile/ProfilePage.jsx'
import { ChangePasswordPage } from '../pages/profile/ChangePasswordPage.jsx'
import { PermissionGate } from '../components/PermissionGate.jsx'
import { PERMS } from '../utils/permissions.js'
import { PendingOtpRedirect } from '../components/auth/PendingOtpRedirect.jsx'

const UsersRoute = () => (
  <PermissionGate
    anyOf={[PERMS.viewUser, 'auth.view_user']}
    fallback={
      <div className="alert alert-warning">
        ইউজার দেখার অনুমতি নেই।
      </div>
    }
  >
    <UsersPage />
  </PermissionGate>
)

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
          <Route path={paths.sites} element={<SitesPage />} />
          <Route path={paths.labours} element={<LaboursPage />} />
          <Route path={paths.users} element={<UsersRoute />} />
          <Route path={paths.profile} element={<ProfilePage />} />
          <Route path={paths.changePassword} element={<ChangePasswordPage />} />

          <Route path="/sites/:id" element={<SiteScopedLayout />}>
            <Route path="daily-ledger" element={<SiteLedgerPage />} />
            <Route path="daily-report" element={<SiteLedgerPage />} />
            <Route path="cash" element={<SiteLedgerPage />} />
            <Route path="private-cash" element={<SiteLedgerPage />} />
          </Route>

          <Route path="/labours/:id" element={<LabourDetailLayout />}>
            <Route index element={<LabourOverviewPage />} />
            <Route
              path="attendances"
              element={<LabourSectionPage title="হাজিরা" />}
            />
            <Route
              path="payments"
              element={<LabourSectionPage title="পেমেন্ট" />}
            />
            <Route
              path="sessions"
              element={<LabourSectionPage title="সেশন" />}
            />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={paths.home} replace />} />
    </Route>
  </Routes>
)
