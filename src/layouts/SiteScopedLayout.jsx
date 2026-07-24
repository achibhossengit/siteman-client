import { useState } from 'react'
import { Outlet, useSearchParams } from 'react-router-dom'
import { DateSelector } from '../components/DateSelector.jsx'
import { SiteSelector } from '../components/SiteSelector.jsx'

/**
 * Nested under AppLayout. Secondary bar: date + site selectors.
 * Used by daily report, daily ledger, cash, private cash.
 */
export const SiteScopedLayout = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [siteId, setSiteId] = useState(searchParams.get('site') || '')

  const date =
    searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const setDate = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('date', next)
    setSearchParams(params, { replace: true })
  }

  const onSiteChange = (next) => {
    setSiteId(next)
    const params = new URLSearchParams(searchParams)
    if (next) params.set('site', next)
    else params.delete('site')
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-base-100 border border-base-300 rounded-box p-3 flex flex-wrap gap-3 items-end">
        <SiteSelector value={siteId} onChange={onSiteChange} />
        <DateSelector value={date} onChange={setDate} />
      </div>
      <Outlet context={{ date, siteId }} />
    </div>
  )
}
