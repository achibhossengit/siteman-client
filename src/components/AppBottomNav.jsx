import { NavLink } from 'react-router-dom'
import { HardHat, MapPin, UserCircle, Users } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions.js'
import { PERMS } from '../utils/permissions.js'
import { paths } from '../router/paths.js'

const navItemClass = ({ isActive }) =>
  [
    'flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] sm:text-xs rounded-lg transition-colors',
    isActive
      ? 'text-primary font-semibold'
      : 'text-base-content/70 hover:text-base-content',
  ].join(' ')

export const AppBottomNav = () => {
  const { canAny } = usePermissions()
  const showUsers = canAny([PERMS.viewUser, 'auth.view_user'])

  const items = [
    { to: paths.sites, label: 'সাইট', icon: MapPin },
    { to: paths.labours, label: 'শ্রমিক', icon: HardHat },
    ...(showUsers
      ? [{ to: paths.users, label: 'ইউজার', icon: Users }]
      : []),
    { to: paths.profile, label: 'প্রোফাইল', icon: UserCircle },
  ]

  return (
    <nav
      className="bg-base-100 border-t border-base-300 fixed bottom-0 inset-x-0 z-30 pb-[env(safe-area-inset-bottom)]"
      aria-label="মূল নেভিগেশন"
    >
      <div className="max-w-5xl mx-auto w-full flex justify-around items-stretch py-1.5 px-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navItemClass}>
            <Icon className="size-5" strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
