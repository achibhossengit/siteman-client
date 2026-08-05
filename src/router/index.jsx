import { Navigate, Route, Routes } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout.jsx";
import { AppLayout } from "../layouts/AppLayout.jsx";
import { ActivityLayout } from "../layouts/ActivityLayout.jsx";
import { SiteScopedLayout } from "../layouts/SiteScopedLayout.jsx";
import { DetailLayout } from "../layouts/DetailLayout.jsx";
import { GuestOnly, RequireAuth } from "./guards.jsx";
import { paths } from "./paths.js";
import { BalancePage } from "../pages/sites/BalancePage.jsx";
import { HajiraPage } from "../pages/sites/HajiraPage.jsx";
import { CashPage } from "../pages/sites/CashPage.jsx";
import { SitesPage } from "../pages/sites/SitesPage.jsx";
import { SiteNewPage } from "../pages/sites/SiteNewPage.jsx";
import { SiteDetailPage } from "../pages/sites/SiteDetailPage.jsx";
import { SiteBillingPage } from "../pages/sites/SiteBillingPage.jsx";
import { PrivateCashPage } from "../pages/sites/PrivateCashPage.jsx";
import { UsersPage } from "../pages/users/UsersPage.jsx";
import { UserNewPage } from "../pages/users/UserNewPage.jsx";
import { UserDetailPage } from "../pages/users/UserDetailPage.jsx";
import { LaboursPage } from "../pages/labours/LaboursPage.jsx";
import { LabourNewPage } from "../pages/labours/LabourNewPage.jsx";
import { LabourDetailPage } from "../pages/labours/LabourDetailPage.jsx";
import { LabourSessionsPage } from "../pages/labours/LabourSessionsPage.jsx";
import { LabourSessionDetailPage } from "../pages/labours/LabourSessionDetailPage.jsx";
import { LabourSessionRecordsPage } from "../pages/labours/LabourSessionRecordsPage.jsx";
import { AppInfoPage } from "../pages/AppInfoPage.jsx";
import { ActivityPage } from "../pages/activities/ActivityPage.jsx";
import { LoginPage } from "../pages/auth/LoginPage.jsx";
import { RegisterPage } from "../pages/auth/RegisterPage.jsx";
import { RegisterConfirmPage } from "../pages/auth/RegisterConfirmPage.jsx";
import { PasswordResetPage } from "../pages/auth/PasswordResetPage.jsx";
import { PasswordResetConfirmPage } from "../pages/auth/PasswordResetConfirmPage.jsx";
import { ProfilePage } from "../pages/profile/ProfilePage.jsx";
import { PendingOtpRedirect } from "./PendingOtpRedirect.jsx";
import { OthersPage } from "../pages/OthersPage.jsx";

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
          <Route element={<SiteScopedLayout />}>
            <Route path={paths.balance} element={<BalancePage />} />
            <Route path={paths.hajira} element={<HajiraPage />} />
            <Route path={paths.cash} element={<CashPage />} />
          </Route>

          <Route path={paths.others} element={<OthersPage />} />
        </Route>

        <Route element={<ActivityLayout />}>
          <Route path={paths.activities} element={<ActivityPage />} />
        </Route>

        <Route element={<DetailLayout />}>
          <Route path={paths.profile} element={<ProfilePage />} />
          <Route path={paths.sites} element={<SitesPage />} />
          <Route path={paths.siteNew} element={<SiteNewPage />} />
          <Route path="/sites/:siteId/billing" element={<SiteBillingPage />} />
          <Route
            path="/sites/:siteId/private-cash"
            element={<PrivateCashPage />}
          />
          <Route path="/sites/:siteId" element={<SiteDetailPage />} />
          <Route path={paths.users} element={<UsersPage />} />
          <Route path={paths.userNew} element={<UserNewPage />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
          <Route path={paths.labours} element={<LaboursPage />} />
          <Route path={paths.labourNew} element={<LabourNewPage />} />
          <Route
            path="/labours/:labourId/sessions/:sessionId/records"
            element={<LabourSessionRecordsPage />}
          />
          <Route
            path="/labours/:labourId/sessions/:sessionId"
            element={<LabourSessionDetailPage />}
          />
          <Route
            path="/labours/:labourId/sessions"
            element={<LabourSessionsPage />}
          />
          <Route path="/labours/:labourId" element={<LabourDetailPage />} />
          <Route path={paths.appInfo} element={<AppInfoPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={paths.balance} replace />} />
    </Route>
  </Routes>
);
