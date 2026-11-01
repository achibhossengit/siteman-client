import { Outlet } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader.jsx'
import { AppBottomNav } from '../components/AppBottomNav.jsx'

/**
 * Brand chrome only (header + bottom nav) — no site/date scoped bar.
 * Used by the activities list page.
 */
export const ActivityLayout = () => (
  <div className="h-full min-h-0 bg-base-200 flex flex-col pb-14 overflow-hidden">
    <AppHeader />
    <main className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
      <Outlet />
    </main>
    <AppBottomNav />
  </div>
)
