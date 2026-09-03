import { Navigate, Route, Routes } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout.jsx";
import { AppLayout } from "../layouts/AppLayout.jsx";
import { ActivityLayout } from "../layouts/ActivityLayout.jsx";
import { SiteScopedLayout } from "../layouts/SiteScopedLayout.jsx";
import { DetailLayout } from "../layouts/DetailLayout.jsx";
import { GuestOnly, RequireAuth, RequireCompanyAdmin } from "./guards.jsx";
import { paths } from "./paths.js";
import { BalancePage } from "../pages/sites/BalancePage.jsx";
import { HajiraPage } from "../pages/sites/HajiraPage.jsx";
import { CashPage } from "../pages/sites/CashPage.jsx";
import { SitesPage } from "../pages/sites/SitesPage.jsx";
import { SiteDetailPage } from "../pages/sites/SiteDetailPage.jsx";
import { UsersPage } from "../pages/users/UsersPage.jsx";
import { UserDetailPage } from "../pages/users/UserDetailPage.jsx";
import { LaboursPage } from "../pages/labours/LaboursPage.jsx";
import { LabourDetailPage } from "../pages/labours/LabourDetailPage.jsx";
import { LabourSessionRecordsPage } from "../pages/labours/LabourSessionRecordsPage.jsx";
import { AppInfoPage } from "../pages/AppInfoPage.jsx";
import { ActivityPage } from "../pages/activities/ActivityPage.jsx";
import { LoginPage } from "../pages/auth/LoginPage.jsx";
import { RegisterPage } from "../pages/auth/RegisterPage.jsx";
import { PasswordResetPage } from "../pages/auth/PasswordResetPage.jsx";
import { PasswordResetConfirmPage } from "../pages/auth/PasswordResetConfirmPage.jsx";
import { ProfilePage } from "../pages/profile/ProfilePage.jsx";
import { CompanySettingsPage } from "../pages/company/CompanySettingsPage.jsx";
import { PendingOtpRedirect } from "./PendingOtpRedirect.jsx";


export const AppRouter = () => (
  <Routes>
    <Route element={<PendingOtpRedirect />}>
      {/* Password-reset OTP must stay reachable even if logged in */}
      <Route element={<AuthLayout />}>
        <Route
          path={paths.passwordResetConfirm}
          element={<PasswordResetConfirmPage />}
        />
      </Route>

      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path={paths.login} element={<LoginPage />} />
          <Route path={paths.register} element={<RegisterPage />} />
          <Route
            path="/register/confirm"
            element={<Navigate to={paths.register} replace />}
          />
          <Route path={paths.passwordReset} element={<PasswordResetPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route element={<SiteScopedLayout />}>
            <Route path={paths.balance} element={<BalancePage />} />
            <Route path={paths.hajira} element={<HajiraPage />} />
            <Route path={paths.cash} element={<CashPage />} />
          </Route>
        </Route>

        <Route element={<ActivityLayout />}>
          <Route path={paths.activities} element={<ActivityPage />} />
        </Route>

        <Route element={<DetailLayout />}>
          <Route path={paths.profile} element={<ProfilePage />} />
          <Route element={<RequireCompanyAdmin />}>
            <Route path={paths.companySettings} element={<CompanySettingsPage />} />
          </Route>
          <Route path={paths.sites} element={<SitesPage />} />
          <Route
            path="/sites/:siteId/billing"
            element={<Navigate to=".." relative="path" replace />}
          />
          <Route
            path="/sites/:siteId/private-cash"
            element={<Navigate to=".." relative="path" replace />}
          />
          <Route path="/sites/:siteId" element={<SiteDetailPage />} />
          <Route path={paths.users} element={<UsersPage />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
          <Route path={paths.labours} element={<LaboursPage />} />
          <Route
            path="/labours/:labourId/sessions/:sessionId/records"
            element={<LabourSessionRecordsPage />}
          />
          <Route
            path="/labours/:labourId/sessions/:sessionId"
            element={<Navigate to="../.." relative="path" replace />}
          />
          <Route
            path="/labours/:labourId/sessions"
            element={<Navigate to=".." relative="path" replace />}
          />
          <Route path="/labours/:labourId" element={<LabourDetailPage />} />
          <Route path={paths.appInfo} element={<AppInfoPage />} />
        </Route>
      </Route>

      <Route
        path={paths.maintenance}
        element={<Navigate to={paths.login} replace />}
      />
      <Route path="*" element={<Navigate to={paths.balance} replace />} />
    </Route>
  </Routes>
);
