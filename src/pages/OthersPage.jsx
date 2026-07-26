import { Link } from 'react-router-dom'
import {
  Building2,
  Info,
  LandPlot,
  Moon,
  Sun,
  Users,
  UserRoundCog,
} from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { THEME_DARK } from '../utils/theme.js'
import { paths } from '../router/paths.js'

const MENU_LINKS = [
  {
    key: 'company',
    title: 'কোম্পানি সেটিংস',
    icon: Building2,
    to: null,
  },
  {
    key: 'sites',
    title: 'সাইট ম্যানেজ',
    icon: LandPlot,
    to: paths.sites,
  },
  {
    key: 'users',
    title: 'ইউজার ম্যানেজ',
    icon: Users,
    to: paths.users,
  },
  {
    key: 'labours',
    title: 'লেবার ম্যানেজ',
    icon: UserRoundCog,
    to: paths.labours,
  },
  {
    key: 'app-info',
    title: 'অ্যাপ তথ্য',
    icon: Info,
    to: paths.appInfo,
  },
]

export const OthersPage = () => {
  const { resolved } = useTheme()
  const isDark = resolved === THEME_DARK

  return (
    <div className="flex flex-col gap-3 p-2 sm:p-3">
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-0">
          <ul className="menu menu-md w-full gap-0 p-1">
            {MENU_LINKS.map(({ key, title, icon: Icon, to }) => (
              <li key={key}>
                {to ? (
                  <Link to={to} className="rounded-lg">
                    <Icon
                      className="size-5 shrink-0 opacity-70"
                      strokeWidth={1.75}
                    />
                    <span>{title}</span>
                  </Link>
                ) : (
                  <a
                    href="#"
                    className="rounded-lg"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Icon
                      className="size-5 shrink-0 opacity-70"
                      strokeWidth={1.75}
                    />
                    <span>{title}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body py-3 px-4 flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {isDark ? (
              <Moon className="size-5 shrink-0 opacity-70" strokeWidth={1.75} />
            ) : (
              <Sun className="size-5 shrink-0 opacity-70" strokeWidth={1.75} />
            )}
            <div className="min-w-0">
              <div className="font-medium">থিম</div>
              <div className="text-xs text-base-content/60">
                {isDark ? 'ডার্ক মোড' : 'লাইট মোড'}
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
