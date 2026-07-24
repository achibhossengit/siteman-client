import { useState } from 'react'
import { Outlet, useParams, useSearchParams } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader.jsx'
import { AppBottomNav } from '../components/AppBottomNav.jsx'
import { DateSelector } from '../components/DateSelector.jsx'
import { SiteSelector } from '../components/SiteSelector.jsx'
import { useHideOnScroll } from '../hooks/useHideOnScroll.js'

/** Brand header height (h-14) — used to tuck it away on scroll-down. */
const BRAND_HEADER_H = '3.5rem'

/**
 * Full app chrome + sticky site/date bar.
 * Scroll down: brand header hides; site bar + bottom nav stay.
 * Scroll up: brand header returns.
 */
export const SiteScopedLayout = () => {
  const brandHidden = useHideOnScroll()
  const { id: routeSiteId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [siteId, setSiteId] = useState(
    () => routeSiteId || searchParams.get('site') || '',
  )

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
    <div className="min-h-dvh bg-base-200 flex flex-col pb-20">
      <div className="sticky top-0 z-30">
        <div
          className={[
            'transition-transform duration-200 ease-out will-change-transform',
            brandHidden ? '-translate-y-full' : 'translate-y-0',
          ].join(' ')}
          style={
            brandHidden ? { marginBottom: `-${BRAND_HEADER_H}` } : undefined
          }
        >
          <AppHeader />
        </div>

        <div className="bg-base-100 border-b border-base-300 px-3 sm:px-4 py-2">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-2 sm:gap-3 items-end">
            <SiteSelector
              className="flex-1"
              value={siteId}
              onChange={onSiteChange}
            />
            <DateSelector
              className="flex-1 "
              value={date}
              onChange={setDate}
            />
          </div>
        </div>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-4">
        <Outlet context={{ date, siteId }} />
      </main>

      <AppBottomNav />
    </div>
  )
}
