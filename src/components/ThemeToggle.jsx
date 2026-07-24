import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { THEME_DARK } from '../utils/theme.js'

export const ThemeToggle = ({ className = '' }) => {
  const { resolved, toggle } = useTheme()
  const isDark = resolved === THEME_DARK

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm btn-square ${className}`}
      onClick={toggle}
      aria-label={isDark ? 'লাইট থিম' : 'ডার্ক থিম'}
      title={isDark ? 'লাইট থিম' : 'ডার্ক থিম'}
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}
