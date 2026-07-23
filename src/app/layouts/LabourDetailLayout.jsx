import { NavLink, Outlet, useParams } from 'react-router-dom'

const tabClass = ({ isActive }) =>
  [
    'tab',
    isActive ? 'tab-active [--tab-bg:var(--color-primary)] text-primary-content' : '',
  ].join(' ')

/**
 * Nested under AppLayout. Page-local tabs for labour detail.
 */
export const LabourDetailLayout = () => {
  const { id } = useParams()
  const base = `/labours/${id}`

  const tabs = [
    { to: base, label: 'ওভারভিউ', end: true },
    { to: `${base}/attendances`, label: 'হাজিরা' },
    { to: `${base}/payments`, label: 'পেমেন্ট' },
    { to: `${base}/sessions`, label: 'সেশন' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="tabs tabs-box bg-base-100 border border-base-300">
        {tabs.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} role="tab" className={tabClass}>
            {label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
