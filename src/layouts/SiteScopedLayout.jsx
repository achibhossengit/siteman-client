import { useEffect, useState } from 'react'
import { Outlet, useSearchParams } from 'react-router-dom'
import { DateSelector } from '../components/DateSelector.jsx'
import { SiteSelector } from '../components/SiteSelector.jsx'
import { useAssignedSites } from '../hooks/useSites.js'
import {
  clampIsoToToday,
  isIsoDate,
  normalizeEndDate,
  todayIso,
} from '../utils/dateRange.js'
import {
  readSelectedEndDate,
  readSelectedSite,
  readSelectedStartDate,
  writeSelectedDateRange,
  writeSelectedSite,
} from '../utils/sessionSelection.js'

const readInitialRange = (searchParams) => {
  const today = todayIso()
  const urlStart = searchParams.get('date')
  const urlEnd = searchParams.get('date_end')
  const start = clampIsoToToday(
    (isIsoDate(urlStart) ? urlStart : '') || readSelectedStartDate() || today,
  )
  const rawEnd =
    (isIsoDate(urlEnd) ? urlEnd : '') || readSelectedEndDate() || ''
  let end = isIsoDate(rawEnd) ? clampIsoToToday(rawEnd) : null
  if (end && end < start) return { start: end, end: start }
  return { start, end: normalizeEndDate(start, end) }
}

/**
 * Sticky date + site selectors; shares selection via outlet context.
 * `date` is the start day (pages still fetch a single date).
 * `dateEnd` is set only for a range; unused by pages until range fetch lands.
 */
export const SiteScopedLayout = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { assignedSites: sites } = useAssignedSites({ includeClosed: false })

  const [siteId, setSiteId] = useState(
    () => searchParams.get('site') || readSelectedSite() || '',
  )
  const [startDate, setStartDate] = useState(
    () => readInitialRange(searchParams).start,
  )
  const [endDate, setEndDate] = useState(
    () => readInitialRange(searchParams).end,
  )

  useEffect(() => {
    if (!sites.length) return
    const stillValid = sites.some((s) => String(s.id) === String(siteId))
    if (stillValid) return
    const saved = readSelectedSite()
    const savedValid = sites.some((s) => String(s.id) === String(saved))
    setSiteId(String(savedValid ? saved : sites[0].id))
  }, [sites, siteId])

  useEffect(() => {
    if (siteId) writeSelectedSite(siteId)
    writeSelectedDateRange(startDate, endDate)

    const params = new URLSearchParams(searchParams)
    let changed = false
    if (siteId && params.get('site') !== String(siteId)) {
      params.set('site', String(siteId))
      changed = true
    }
    if (startDate && params.get('date') !== startDate) {
      params.set('date', startDate)
      changed = true
    }
    const urlEnd = endDate && endDate !== startDate ? endDate : null
    if (urlEnd) {
      if (params.get('date_end') !== urlEnd) {
        params.set('date_end', urlEnd)
        changed = true
      }
    } else if (params.has('date_end')) {
      params.delete('date_end')
      changed = true
    }
    if (changed) setSearchParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on selection
  }, [siteId, startDate, endDate])

  const onDateChange = ({ start, end }) => {
    const nextStart = clampIsoToToday(start || todayIso())
    const nextEnd = normalizeEndDate(nextStart, end)
    setStartDate(nextStart)
    setEndDate(nextEnd)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="bg-base-100 border-b border-base-300 w-full shrink-0 z-30">
        <div className="max-w-5xl mx-auto w-full flex justify-between gap-2 items-stretch px-2 py-1.5">
          <DateSelector
            startDate={startDate}
            endDate={endDate}
            onChange={onDateChange}
          />
          <SiteSelector sites={sites} value={siteId} onChange={setSiteId} />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-5xl mx-auto flex flex-col">
        <Outlet
          context={{
            date: startDate,
            dateEnd: endDate,
            startDate,
            endDate,
            siteId,
            sites,
          }}
        />
      </main>
    </div>
  )
}
