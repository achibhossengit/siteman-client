import { useEffect, useState } from 'react'

export const OPEN_TRANSITION_MS = 200

/** Keep a popover mounted through its close animation. */
export const useOpenTransition = (open) => {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const timeout = setTimeout(() => setMounted(false), OPEN_TRANSITION_MS)
    return () => clearTimeout(timeout)
  }, [open])

  return { mounted, shown }
}

export const openPanelMotionClass = (shown) =>
  [
    'transition-[opacity,transform] duration-200 ease-out',
    shown
      ? 'opacity-100 translate-y-0 scale-100'
      : 'pointer-events-none opacity-0 -translate-y-1 scale-95',
  ].join(' ')
