import { Link, NavLink } from 'react-router-dom'
import { BrandLogo } from './BrandLogo.jsx'
import { PersonAvatar } from './PersonAvatar.jsx'
import { MAINTENANCE } from '../config/features.js'
import { useAuth } from '../providers/AuthProvider.jsx'
import { paths } from '../router/paths.js'

/**
 * Shared top chrome: brand + auth actions (login/register or profile).
 */
export const AppHeader = () => {
  const { isAuthenticated, profile, company } = useAuth()

  const companyName = company?.name?.trim() || ''
  const userName = profile?.name?.trim() || ''

  return (
    <header className="bg-base-100 border-b border-base-300 w-full sticky top-0 z-30 h-14">
      <div className="max-w-5xl mx-auto w-full flex justify-between items-center gap-2 px-2 py-1.5">
        <div className="flex items-end gap-2 min-w-0">
          <BrandLogo />
          <p className="text-md sm:text-lg font-medium text-base-content leading-normal">
            সাইটম্যান
          </p>
        </div>

        {MAINTENANCE ? null : (
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {isAuthenticated ? (
              <>
                {companyName || userName ? (
                  <div className="min-w-0 leading-tight text-right">
                    {companyName ? (
                      <p className="text-sm font-medium text-base-content truncate max-w-28 sm:max-w-44">
                        {companyName}
                      </p>
                    ) : null}
                    {userName ? (
                      <p className="text-xs text-base-content/55 truncate max-w-28 sm:max-w-44">
                        {userName}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <Link
                  to={paths.profile}
                  className="shrink-0"
                  aria-label="প্রোফাইল"
                  title={userName || companyName || 'প্রোফাইল'}
                >
                  <PersonAvatar
                    photo={profile?.photo}
                    name={userName}
                    size="sm"
                    alt={userName || 'প্রোফাইল'}
                  />
                </Link>
              </>
            ) : (
              <NavLink to={paths.login} className="btn btn-primary btn-sm">
                লগইন করুন
              </NavLink>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
