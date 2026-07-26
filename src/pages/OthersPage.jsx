import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronRight,
  Info,
  LandPlot,
  LogOut,
  Moon,
  Sun,
  Users,
  UserRoundCog,
} from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { useAuth } from '../providers/AuthProvider.jsx'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { THEME_DARK } from '../utils/theme.js'
import { paths } from '../router/paths.js'

const SETTINGS_LINKS = [
  {
    key: 'company',
    title: 'কোম্পানি সেটিংস',
    icon: Building2,
    to: null,
  },
]

const MANAGE_LINKS = [
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
]

const OTHER_LINKS = [
  {
    key: 'app-info',
    title: 'এই অ্যাপ সম্পর্কে',
    icon: Info,
    to: paths.appInfo,
  },
]

const initialsFromName = (name) => {
  if (!name || typeof name !== 'string') return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

const roleLabel = (profile) => {
  if (!profile) return '—'
  if (profile.is_companyadmin) return 'অ্যাডমিন'
  const group = profile.groups?.[0]?.name
  return group || 'ইউজার'
}

const MenuRow = ({ icon: Icon, title, to, onClick, trailing, danger }) => {
  const content = (
    <>
      <Icon
        className={[
          'size-5 shrink-0',
          danger ? 'text-error' : 'text-base-content/70',
        ].join(' ')}
        strokeWidth={1.75}
      />
      <span
        className={[
          'flex-1 text-left text-[15px]',
          danger ? 'text-error font-medium' : 'text-base-content',
        ].join(' ')}
      >
        {title}
      </span>
      {trailing ??
        (danger ? null : (
          <ChevronRight
            className="size-5 shrink-0 text-base-content/35"
            strokeWidth={1.75}
          />
        ))}
    </>
  )

  const rowClass =
    'flex w-full items-center gap-3 px-4 py-3.5 active:bg-base-200/70 transition-colors'

  if (to) {
    return (
      <Link to={to} className={rowClass}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" className={rowClass} onClick={onClick}>
      {content}
    </button>
  )
}

const MenuCard = ({ children }) => (
  <div className="bg-base-100 rounded-2xl border border-base-300/80 overflow-hidden divide-y divide-base-300/70">
    {children}
  </div>
)

const SectionLabel = ({ children }) => (
  <h2 className="text-sm font-medium text-base-content/55 px-1 mb-1.5">
    {children}
  </h2>
)

export const OthersPage = () => {
  const navigate = useNavigate()
  const { profile, logout } = useAuth()
  const { resolved } = useTheme()
  const isDark = resolved === THEME_DARK
  const [loggingOut, setLoggingOut] = useState(false)

  const onLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate(paths.login, { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }


  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4 max-w-lg mx-auto w-full pb-6">
      <Link
        to={paths.profile}
        className="flex items-center gap-3 px-1 py-1 rounded-xl active:bg-base-200/60"
      >
        <div className="avatar placeholder shrink-0">
          <img src={profile?.image || '/user.png'} alt="user" className="size-10 rounded-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-base truncate">{profile?.name}</div>
          <div className="text-sm text-base-content/55 truncate">
            {roleLabel(profile)}
          </div>
        </div>
        <ChevronRight
          className="size-5 shrink-0 text-base-content/35"
          strokeWidth={1.75}
        />
      </Link>

      <MenuCard>
        {SETTINGS_LINKS.map((item) => (
          <MenuRow
            key={item.key}
            icon={item.icon}
            title={item.title}
            to={item.to}
          />
        ))}
      </MenuCard>

      <div>
        <SectionLabel>ম্যানেজ</SectionLabel>
        <MenuCard>
          {MANAGE_LINKS.map((item) => (
            <MenuRow
              key={item.key}
              icon={item.icon}
              title={item.title}
              to={item.to}
            />
          ))}
        </MenuCard>
      </div>

      <div>
        <SectionLabel>অন্যান্য</SectionLabel>
        <MenuCard>
          {OTHER_LINKS.map((item) => (
            <MenuRow
              key={item.key}
              icon={item.icon}
              title={item.title}
              to={item.to}
            />
          ))}
          <div className="flex w-full items-center gap-3 px-4 py-3.5">
            {isDark ? (
              <Moon
                className="size-5 shrink-0 text-base-content/70"
                strokeWidth={1.75}
              />
            ) : (
              <Sun
                className="size-5 shrink-0 text-base-content/70"
                strokeWidth={1.75}
              />
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[15px]">থিম</div>
              <div className="text-xs text-base-content/55">
                {isDark ? 'ডার্ক মোড' : 'লাইট মোড'}
              </div>
            </div>
            <ThemeToggle />
          </div>
        </MenuCard>
      </div>

      <MenuCard>
        <MenuRow
          icon={LogOut}
          title={loggingOut ? 'লগআউট হচ্ছে…' : 'লগ আউট'}
          onClick={onLogout}
          danger
        />
      </MenuCard>
    </div>
  )
}
