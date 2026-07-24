import { Outlet } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader.jsx'

export const AuthLayout = () => (
  <div className="min-h-dvh bg-base-200 flex flex-col">
    <AppHeader />

    <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </main>

    <footer className="border-t border-base-300 bg-base-100 px-4 py-2.5 text-center text-[11px] sm:text-xs text-base-content/55">
      © {new Date().getFullYear()} আছিব হোসেন · সকল অধিকার সংরক্ষিত
    </footer>
  </div>
)
