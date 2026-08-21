import { Navigate, Route, Routes } from 'react-router-dom'
import { MAINTENANCE } from './config/features.js'
import { AuthLayout } from './layouts/AuthLayout.jsx'
import { MaintenancePage } from './pages/MaintenancePage.jsx'
import { AppRouter } from './router/index.jsx'
import { paths } from './router/paths.js'

const MaintenanceRouter = () => (
  <Routes>
    <Route element={<AuthLayout />}>
      <Route path={paths.maintenance} element={<MaintenancePage />} />
    </Route>
    <Route path="*" element={<Navigate to={paths.maintenance} replace />} />
  </Routes>
)

const App = () => (MAINTENANCE ? <MaintenanceRouter /> : <AppRouter />)

export default App
