import { createContext, useContext, useEffect, useState } from 'react'
import {
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
  THEME_SYSTEM,
  applyTheme,
  resolveTheme,
} from '../../shared/lib/theme.js'

const ThemeContext = createContext(null)

const readStoredPreference = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === THEME_LIGHT || stored === THEME_DARK || stored === THEME_SYSTEM) {
      return stored
    }
  } catch {
    // ignore
  }
  return THEME_SYSTEM
}

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(readStoredPreference)

  useEffect(() => {
    applyTheme(resolveTheme(preference))
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    } catch {
      // ignore
    }
  }, [preference])

  useEffect(() => {
    if (preference !== THEME_SYSTEM) return undefined

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(resolveTheme(THEME_SYSTEM))
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const value = {
    preference,
    resolved: resolveTheme(preference),
    setPreference,
    setLight: () => setPreference(THEME_LIGHT),
    setDark: () => setPreference(THEME_DARK),
    setSystem: () => setPreference(THEME_SYSTEM),
    toggle: () =>
      setPreference((prev) =>
        resolveTheme(prev) === THEME_DARK ? THEME_LIGHT : THEME_DARK,
      ),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
