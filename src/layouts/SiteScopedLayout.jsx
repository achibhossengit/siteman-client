import { useEffect, useState } from 'react'
import { Outlet, useSearchParams } from 'react-router-dom'
import { DateSelector } from '../components/DateSelector.jsx'
import { SiteSelector } from '../components/SiteSelector.jsx'
import { useAssignedSites } from '../hooks/useSites.js'
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
  const [searchParams, setSearchParams] = useSearchParams()
  // Non-closed sites only; deactivated sites stay selectable for existing data.
  const { assignedSites: sites } = useAssignedSites({ includeClosed: false })

  const [siteId, setSiteId] = useState(
    () => searchParams.get('site') || readSelectedSite() || '',
  )
  const [date, setDate] = useState(
    () => searchParams.get('date') || readSelectedDate() || todayIso() || '',
  )

  // When lookup loads, pick a valid site if current selection is missing.
  useEffect(() => {
    if (!sites.length) return
    const stillValid = sites.some((s) => String(s.id) === String(siteId))
    if (stillValid) return
    const saved = readSelectedSite()
    const savedValid = sites.some((s) => String(s.id) === String(saved))
    setSiteId(String(savedValid ? saved : sites[0].id))
  }, [sites, siteId])

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
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="bg-base-100 border-b border-base-300 w-full shrink-0 z-30">
        <div className="max-w-5xl mx-auto w-full flex justify-between gap-2 items-stretch px-2 py-1.5">
          <DateSelector value={date} onChange={setDate} />
          <SiteSelector sites={sites} value={siteId} onChange={setSiteId} />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-5xl mx-auto flex flex-col">
        <Outlet context={{ date, siteId, sites }} />
      </main>
    </div>
  )
}
