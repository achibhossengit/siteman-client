import { NavLink } from 'react-router-dom'
import { paths } from '../router/paths.js'
import { CalendarCheck, Wallet, Menu, Banknote } from 'lucide-react'

const navItemClass = ({ isActive }) =>
  [
    'flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] sm:text-xs rounded-lg transition-colors',
    isActive
      ? 'text-primary font-semibold'
      : 'text-base-content/70 hover:text-base-content',
  ].join(' ')

export const AppBottomNav = () => {
  const items = [
    { to: paths.balance, label: 'ব্যালেন্স', icon: Banknote, end: true },
    { to: paths.hajira, label: 'হাজিরা', icon: CalendarCheck },
    { to: paths.cash, label: 'ক্যাশ', icon: Wallet },
    { to: paths.others, label: 'আরও', icon: Menu },
  ]

  return (
    <nav className="bg-base-100 border-t border-base-300 fixed bottom-0 inset-x-0 z-30 h-14">
      <div className="max-w-5xl mx-auto w-full flex justify-between items-stretch py-1.5 px-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={label} to={to} end={end} className={navItemClass}>
            <Icon className="size-5" strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
