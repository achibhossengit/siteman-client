import { Outlet } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'

export const AuthLayout = () => (
  <div className="min-h-dvh bg-base-200 flex flex-col">
    <header className="navbar bg-base-100 border-b border-base-300 px-4">
      <div className="flex-1">
        <BrandLogo to="/login" />
      </div>
      <div className="flex-none">
        <ThemeToggle />
      </div>
    </header>

    <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </main>

    <footer className="footer footer-center bg-base-100 border-t border-base-300 text-base-content/60 p-4 text-xs">
      <p>সাইট ম্যান · নির্মাণ সাইট ব্যবস্থাপনা</p>
    </footer>
  </div>
)
