import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout.jsx'
import { AppLayout } from '../layouts/AppLayout.jsx'
import { SiteScopedLayout } from '../layouts/SiteScopedLayout.jsx'
import { DetailLayout } from '../layouts/DetailLayout.jsx'
import { LabourDetailTabs } from '../layouts/LabourDetailTabs.jsx'
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
      <div className="alert alert-warning">ইউজার দেখার অনুমতি নেই।</div>
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
        </Route>

        {/* Own chrome: brand hide-on-scroll + site/date bar + bottom nav */}
        <Route element={<SiteScopedLayout />}>
          <Route
            path="/sites/:id/daily-ledger"
            element={<SiteLedgerPage />}
            handle={{ title: 'দৈনিক খাতা' }}
          />
          <Route
            path="/sites/:id/daily-report"
            element={<SiteLedgerPage />}
            handle={{ title: 'দৈনিক রিপোর্ট' }}
          />
          <Route
            path="/sites/:id/cash"
            element={<SiteLedgerPage />}
            handle={{ title: 'ক্যাশ' }}
          />
          <Route
            path="/sites/:id/private-cash"
            element={<SiteLedgerPage />}
            handle={{ title: 'প্রাইভেট ক্যাশ' }}
          />
        </Route>

        {/* Back + title only — maximize content */}
        <Route element={<DetailLayout />}>
          <Route
            path="/labours/:id"
            element={<LabourDetailTabs />}
            handle={{ title: 'শ্রমিক বিবরণ' }}
          >
            <Route
              index
              element={<LabourOverviewPage />}
              handle={{ title: 'শ্রমিক · ওভারভিউ' }}
            />
            <Route
              path="attendances"
              element={<LabourSectionPage title="হাজিরা" />}
              handle={{ title: 'শ্রমিক · হাজিরা' }}
            />
            <Route
              path="payments"
              element={<LabourSectionPage title="পেমেন্ট" />}
              handle={{ title: 'শ্রমিক · পেমেন্ট' }}
            />
            <Route
              path="sessions"
              element={<LabourSectionPage title="সেশন" />}
              handle={{ title: 'শ্রমিক · সেশন' }}
            />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={paths.home} replace />} />
    </Route>
  </Routes>
)
