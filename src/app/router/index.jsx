import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout.jsx'
import { AppLayout } from '../layouts/AppLayout.jsx'
import { SiteScopedLayout } from '../layouts/SiteScopedLayout.jsx'
import { LabourDetailLayout } from '../layouts/LabourDetailLayout.jsx'
import {
  HomePage,
  LabourOverviewPage,
  LabourSectionPage,
  LaboursPage,
  LoginPage,
  ProfilePage,
  SiteLedgerPage,
  SitesPage,
  UsersPage,
} from './placeholders.jsx'
import { paths } from './paths.js'

export const AppRouter = () => (
  <Routes>
    <Route element={<AuthLayout />}>
      <Route path={paths.login} element={<LoginPage />} />
      <Route path={paths.register} element={<LoginPage />} />
      <Route path={paths.passwordReset} element={<LoginPage />} />
    </Route>

    <Route element={<AppLayout />}>
      <Route index element={<HomePage />} />
      <Route path={paths.sites} element={<SitesPage />} />
      <Route path={paths.labours} element={<LaboursPage />} />
      <Route path={paths.users} element={<UsersPage />} />
      <Route path={paths.profile} element={<ProfilePage />} />

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

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)
