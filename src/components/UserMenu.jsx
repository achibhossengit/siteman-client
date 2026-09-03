import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronRight,
  Info,
  LandPlot,
  LogOut,
  Moon,
  Sun,
  UserRoundCog,
  Users,
} from 'lucide-react'
import { PersonAvatar } from './PersonAvatar.jsx'
import { ThemeToggle } from './ThemeToggle.jsx'
import { useAuth } from '../providers/AuthProvider.jsx'
import { usePermissions } from '../hooks/usePermissions.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { confirmAction } from '../utils/feedback.js'
import { hasPermissionSuffix, PERMS } from '../utils/permissions.js'
import { THEME_DARK } from '../utils/theme.js'
import { paths } from '../router/paths.js'

const SITE_PERMS = [
  PERMS.viewSite, PERMS.addSite, PERMS.changeSite, PERMS.deleteSite,
  PERMS.viewPrivateSiteCash, PERMS.addPrivateSiteCash,
  PERMS.changePrivateSiteCash, PERMS.deletePrivateSiteCash,
]

const USER_PERMS = [
  PERMS.viewUser, PERMS.addUser, PERMS.changeUser, PERMS.deleteUser,
  PERMS.viewUserSite, PERMS.addUserSite, PERMS.changeUserSite, PERMS.deleteUserSite,
  PERMS.viewGroup, PERMS.addGroup, PERMS.changeGroup, PERMS.deleteGroup,
]

const LABOUR_PERMS = [
  PERMS.viewLabour, PERMS.addLabour, PERMS.changeLabour, PERMS.deleteLabour,
  PERMS.viewDailyRecord, PERMS.addDailyRecord, PERMS.changeDailyRecord, PERMS.deleteDailyRecord,
  PERMS.viewLabourSession, PERMS.addLabourSession, PERMS.changeLabourSession, PERMS.deleteLabourSession,
]


const MenuItem = ({ icon: Icon, title, to, onClick, danger, disabled, trailing, onClose }) => {
  const cls = [
    'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors',
    disabled
      ? 'opacity-50 cursor-not-allowed'
      : 'hover:bg-base-200/70 active:bg-base-200',
  ].join(' ')

  const iconCls = [
    'size-[18px] shrink-0',
    disabled ? 'text-base-content/30' : danger ? 'text-error' : 'text-base-content/60',
  ].join(' ')

  const textCls = [
    'flex-1 text-left',
    disabled ? 'text-base-content/40' : danger ? 'text-error font-medium' : 'text-base-content',
  ].join(' ')

  const content = (
    <>
      <Icon className={iconCls} strokeWidth={1.75} />
      <span className={textCls}>{title}</span>
      {trailing ?? (danger || disabled ? null : (
        <ChevronRight className="size-4 shrink-0 text-base-content/30" strokeWidth={1.75} />
      ))}
    </>
  )

  if (disabled) {
    return <div className={cls}>{content}</div>
  }
  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClose}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  )
}


export const UserMenu = () => {
  const navigate = useNavigate()
  const { profile, logout } = useAuth()
  const { canAny, isCompanyAdmin } = usePermissions()
  const { resolved } = useTheme()
  const isDark = resolved === THEME_DARK
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef(null)
  const btnRef = useRef(null)

  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close()
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const onLogout = async () => {
    if (loggingOut) return
    close()
    const ok = await confirmAction({
      title: 'লগ আউট করবেন?',
      text: 'আপনি অ্যাপ থেকে সাইন আউট হয়ে যাবেন।',
      confirmText: 'লগ আউট',
      danger: true,
    })
    if (!ok) return
    setLoggingOut(true)
    try {
      await logout()
      navigate(paths.login, { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  const userName = profile?.name?.trim() || ''

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="shrink-0 rounded-full ring-offset-base-100 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => setOpen((v) => !v)}
        aria-label="ইউজার মেনু"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <PersonAvatar
          photo={profile?.photo}
          name={userName}
          size="sm"
          alt={userName || 'প্রোফাইল'}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed right-2 top-14 w-60 rounded-2xl border border-base-300 bg-base-100 shadow-xl shadow-base-content/10 overflow-y-auto max-h-[calc(100dvh-4.5rem)] animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Profile header */}
          <Link
            to={paths.profile}
            onClick={close}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-base-200/60 transition-colors border-b border-base-300/70"
          >
            <PersonAvatar
              photo={profile?.photo}
              name={userName}
              size="sm"
              alt={userName || 'প্রোফাইল'}
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{userName}</div>
              <div className="text-xs text-base-content/55 truncate">
                {profile?.phone_number || ''}
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-base-content/30" strokeWidth={1.75} />
          </Link>

          {/* Company settings */}
          {isCompanyAdmin && (
            <div className="border-b border-base-300/70">
              <MenuItem
                icon={Building2}
                title="কোম্পানি সেটিং"
                to={paths.companySettings}
                onClose={close}
              />
            </div>
          )}

          {/* Manage section */}
          {(canAny(USER_PERMS) || canAny(SITE_PERMS) || canAny(LABOUR_PERMS)) && (
            <div className="border-b border-base-300/70">
              {canAny(USER_PERMS) && (
                <MenuItem icon={Users} title="ইউজার ম্যানেজ" to={paths.users} onClose={close} />
              )}
              {canAny(SITE_PERMS) && (
                <MenuItem icon={LandPlot} title="সাইট ম্যানেজ" to={paths.sites} onClose={close} />
              )}
              {canAny(LABOUR_PERMS) && (
                <MenuItem icon={UserRoundCog} title="শ্রমিক ম্যানেজ" to={paths.labours} onClose={close} />
              )}
            </div>
          )}

          {/* Others section */}
          <div className="border-b border-base-300/70">
            <MenuItem
              icon={Info}
              title="সাপোর্ট"
              to={paths.appInfo}
              onClose={close}
            />
            <div className="flex w-full items-center gap-3 px-4 py-2.5">
              {isDark ? (
                <Moon className="shrink-0 text-base-content/60" strokeWidth={1.75} />
              ) : (
                <Sun className="shrink-0 text-base-content/60" strokeWidth={1.75} />
              )}
              <span className="flex-1 text-sm text-left">থিম</span>
              <ThemeToggle />
            </div>
          </div>

          {/* Logout */}
          <MenuItem
            icon={LogOut}
            title={loggingOut ? 'লগআউট হচ্ছে…' : 'লগ আউট'}
            onClick={onLogout}
            danger
          />
        </div>
      )}
    </div>
  )
}
