import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft, MoreVertical } from 'lucide-react'

/**
 * Minimal chrome for create/detail flows: back + title + optional menu.
 * Child pages set title/menu via outlet context: `setTitle`, `setHeaderMenu`.
 */
export const DetailLayout = () => {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [headerMenu, setHeaderMenu] = useState(null)

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="h-dvh bg-base-200 flex flex-col overflow-hidden">
      <header className="bg-base-100 border-b border-base-300 shrink-0 h-14">
        <div className="max-w-5xl mx-auto w-full h-full flex items-center gap-1 px-1">
          <button
            type="button"
            className="btn btn-ghost btn-square btn-sm"
            onClick={goBack}
            aria-label="পিছনে"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </button>

          <h1 className="flex-1 text-base sm:text-lg font-semibold truncate px-1">
            {title}
          </h1>

          <div className="shrink-0 max-w-[45%] flex items-center justify-end min-w-10">
            {headerMenu}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-5xl mx-auto flex flex-col overflow-hidden">
        <Outlet context={{ setTitle, setHeaderMenu }} />
      </main>
    </div>
  )
}

/** Optional 3-dot trigger for detail menus — pages render dropdown content. */
export const DetailMenuButton = ({ children, ...props }) => (
  <div className="dropdown dropdown-end">
    <button
      type="button"
      tabIndex={0}
      className="btn btn-ghost btn-square btn-sm"
      aria-label="মেনু"
      {...props}
    >
      <MoreVertical className="size-5" strokeWidth={1.75} />
    </button>
    {children}
  </div>
)
