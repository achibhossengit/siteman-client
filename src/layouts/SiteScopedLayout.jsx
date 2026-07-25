import { useEffect, useMemo, useState } from 'react'
import { Outlet, useSearchParams } from 'react-router-dom'
import { DateSelector } from '../components/DateSelector.jsx'
import { SiteSelector } from '../components/SiteSelector.jsx'
import { useAuth } from '../providers/AuthProvider.jsx'
import {
  readSelectedDate,
  readSelectedSite,
  todayIso,
  writeSelectedDate,
  writeSelectedSite,
} from '../utils/sessionSelection.js'

/**
 * Sticky date + site selectors; shares selection via outlet context.
 */
export const SiteScopedLayout = () => {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // non closed sites; deactivated sites are allowed to be selected,
  // to see existing data.
  const sites = useMemo(() => {
    const list = Array.isArray(profile?.sites) ? profile.sites : []
    return list.filter((s) => s && s.id != null && s.closed !== false)
  }, [profile])
  
  const [siteId, setSiteId] = useState(
    () => searchParams.get('site') || readSelectedSite() || sites[0]?.id || '',
  )
  const [date, setDate] = useState(
    () => searchParams.get('date') || readSelectedDate() || todayIso() || '',
  )

  // Keep URL + sessionStorage in sync with selection.
  useEffect(() => {
    if (siteId) writeSelectedSite(siteId)
    if (date) writeSelectedDate(date)

    const params = new URLSearchParams(searchParams)
    let changed = false
    if (siteId && params.get('site') !== String(siteId)) {
      params.set('site', String(siteId))
      changed = true
    }
    if (date && params.get('date') !== date) {
      params.set('date', date)
      changed = true
    }
    if (changed) setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on site/date
  }, [siteId, date])

  return (
    <div>
      <header className="bg-base-100 border-b border-base-300 w-full sticky top-14 z-30">
        <div className="max-w-5xl mx-auto w-full flex justify-between gap-2 items-stretch px-2 py-1.5">
          <DateSelector value={date} onChange={setDate} />
          <SiteSelector sites={sites} value={siteId} onChange={setSiteId} />
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 py-2">
        <Outlet context={{ date, siteId, sites }} />
      </main>
    </div>
  )
}
