import { Outlet, useMatches, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle.jsx'

/**
 * Minimal chrome for detail screens: back + title only.
 * Maximize content space — no bottom nav.
 * Set title via route handle: `{ handle: { title: '...' } }`
 * or deeper child handle overrides parent.
 */
export const DetailLayout = () => {
  const navigate = useNavigate()
  const matches = useMatches()
  const title =
    [...matches]
      .reverse()
      .find((m) => m.handle && typeof m.handle.title === 'string')?.handle
      .title ?? 'বিস্তারিত'

  return (
    <div className="min-h-dvh bg-base-200 flex flex-col">
      <header className="sticky top-0 z-30 navbar min-h-14 h-14 bg-base-100 border-b border-base-300 px-2 sm:px-3 gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={() => {
            if (window.history.length > 1) navigate(-1)
            else navigate('/')
          }}
          aria-label="পিছনে"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </button>
        <h1 className="flex-1 text-base font-semibold truncate px-1">
          {title}
        </h1>
        <ThemeToggle />
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-4">
        <Outlet />
      </main>
    </div>
  )
}

/** @deprecated Prefer DetailLayout — kept as alias during rename. */
export const LabourDetailLayout = DetailLayout
