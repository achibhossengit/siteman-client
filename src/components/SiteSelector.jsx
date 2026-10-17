import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import {
  openPanelMotionClass,
  useOpenTransition,
} from '../hooks/useOpenTransition.js'

const PANEL_WIDTH = 224

const panelClass =
  'bg-base-100 rounded-box shadow-lg border border-base-300 overflow-hidden flex flex-col w-56 max-w-[calc(100vw-16px)] origin-top-right'

export const SiteSelector = ({
  sites = [],
  value,
  onChange,
  className = '',
}) => {
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const { mounted, shown } = useOpenTransition(open)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const selected = sites.find((site) => String(site.id) === String(value))
  const label = selected?.name || 'সাইট নির্বাচন করুন'

  const updatePos = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(window.innerWidth - 16, PANEL_WIDTH)
    const left = Math.min(
      Math.max(8, r.right - width),
      window.innerWidth - width - 8,
    )
    const top = r.bottom + 8
    setPos({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onWin = () => updatePos()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target)) return
      if (triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (id) => {
    onChange?.(String(id))
    setOpen(false)
  }

  return (
    <div className={`form-control w-full max-w-xs ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="input input-bordered input-sm w-full flex items-center justify-between gap-1 cursor-pointer text-left font-normal"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="সাইট নির্বাচন"
        onClick={() => setOpen((next) => !next)}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={`size-4 shrink-0 opacity-60 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={1.75}
        />
      </button>

      {mounted
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="সাইট নির্বাচন"
              className={`${panelClass} ${openPanelMotionClass(shown)}`}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                zIndex: 80,
                maxWidth: 'calc(100vw - 16px)',
              }}
            >
              <div className="p-3">
                <p className="text-sm font-medium mb-2">সাইট নির্বাচন</p>
                <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
                  {sites.length > 0 ? (
                    sites.map((site) => {
                      const active = String(site.id) === String(value)
                      return (
                        <button
                          key={site.id}
                          type="button"
                          className={[
                            'btn btn-ghost btn-sm justify-start font-normal h-8 min-h-8',
                            active ? 'bg-base-300 hover:bg-base-300' : '',
                          ].join(' ')}
                          onClick={() => pick(site.id)}
                        >
                          {site.name}
                        </button>
                      )
                    })
                  ) : (
                    <p className="text-sm text-base-content/60 py-2">
                      কোনো সাইট নেই।
                    </p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
