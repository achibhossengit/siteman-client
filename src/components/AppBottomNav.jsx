import { NavLink } from 'react-router-dom'
import { paths } from '../router/paths.js'
import {
  Banknote,
  CalendarCheck,
  ClipboardList,
  Menu,
  Wallet,
} from 'lucide-react'

const navItemClass = ({ isActive }) =>
  [
    'flex flex-col items-center gap-0.5 px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs rounded-lg transition-colors min-w-0 flex-1',
    isActive
      ? 'text-primary font-semibold'
      : 'text-base-content/70 hover:text-base-content',
  ].join(' ')

export const AppBottomNav = () => {
  const items = [
    { to: paths.balance, label: 'ব্যালেন্স', icon: Banknote, end: true },
    { to: paths.hajira, label: 'হাজিরা', icon: CalendarCheck },
    { to: paths.cash, label: 'ক্যাশ', icon: Wallet, end: true },
    { to: paths.activities, label: 'অডিট', icon: ClipboardList },
    { to: paths.others, label: 'আরও', icon: Menu },
  ]

  return (
    <nav className="bg-base-100 border-t border-base-300 fixed bottom-0 inset-x-0 z-30 h-14">
      <div className="max-w-5xl mx-auto w-full flex justify-between items-stretch py-1.5 px-0.5 sm:px-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={label} to={to} end={end} className={navItemClass}>
            <Icon className="size-5 shrink-0" strokeWidth={1.75} />
            <span className="truncate max-w-full">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
