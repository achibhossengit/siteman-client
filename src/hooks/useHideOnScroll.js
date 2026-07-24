import { useEffect, useRef, useState } from 'react'

/**
 * Hide chrome when scrolling down; show again when scrolling up.
 * Near top of page always shows.
 */
export const useHideOnScroll = ({ threshold = 8, topReveal = 48 } = {}) => {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY

    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastY.current

      if (y <= topReveal) {
        setHidden(false)
      } else if (delta > threshold) {
        setHidden(true)
      } else if (delta < -threshold) {
        setHidden(false)
      }

      lastY.current = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold, topReveal])

  return hidden
}
