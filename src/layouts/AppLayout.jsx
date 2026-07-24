import { NavLink, Outlet } from 'react-router-dom'
import { HardHat, MapPin, UserCircle, Users } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo.jsx'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { useAuth } from '../providers/AuthProvider.jsx'
import { usePermissions } from '../hooks/usePermissions.js'
import { PERMS } from '../utils/permissions.js'
import { paths } from '../router/paths.js'

const navItemClass = ({ isActive }) =>
  [
    'flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] sm:text-xs rounded-lg transition-colors',
    isActive ? 'text-primary font-semibold' : 'text-base-content/70 hover:text-base-content',
  ].join(' ')

export const AppLayout = () => {
  const { profile } = useAuth()
  const { canAny } = usePermissions()

  const showUsers = canAny([PERMS.viewUser, 'auth.view_user'])

  const bottomNav = [
    { to: paths.sites, label: 'সাইট', icon: MapPin },
    { to: paths.labours, label: 'শ্রমিক', icon: HardHat },
    ...(showUsers
      ? [{ to: paths.users, label: 'ইউজার', icon: Users }]
      : []),
    { to: paths.profile, label: 'প্রোফাইল', icon: UserCircle },
  ]

  const initial =
    profile?.name?.trim()?.charAt(0)?.toUpperCase() || null

  return (
    <div className="min-h-dvh bg-base-200 flex flex-col pb-20">
      <header className="navbar sticky top-0 z-30 bg-base-100 border-b border-base-300 px-3 sm:px-4">
        <div className="flex-1">
          <BrandLogo compact />
        </div>
        <div className="flex-none flex items-center gap-1">
          <ThemeToggle />
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content w-8 rounded-full">
              {initial ? (
                <span className="text-xs font-semibold">{initial}</span>
              ) : (
                <img src="/user.png" alt="" className="object-cover" />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-4">
        <Outlet />
      </main>

      <nav
        className="bg-base-100 border-t border-base-300 fixed bottom-0 inset-x-0 z-30"
        aria-label="মূল নেভিগেশন"
      >
        <div className="max-w-5xl mx-auto w-full flex justify-around items-stretch py-1.5 px-1">
          {bottomNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navItemClass}>
              <Icon className="size-5" strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
