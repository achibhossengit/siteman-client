import { Outlet } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader.jsx'
import { AppBottomNav } from '../components/AppBottomNav.jsx'

export const AppLayout = () => (
  <div className="min-h-dvh bg-base-200 flex flex-col pb-20">
    <AppHeader sticky />
    <main className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-4">
      <Outlet />
    </main>
    <AppBottomNav />
  </div>
)
