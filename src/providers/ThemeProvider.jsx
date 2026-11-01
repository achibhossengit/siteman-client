import { createContext, useContext, useEffect, useState } from 'react'
import {
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
  THEME_SYSTEM,
  applyTheme,
  resolveTheme,
} from '../utils/theme.js'

const ThemeContext = createContext(null)

/** Flip to true to restore preference storage + system/dark switching. */
export const THEME_TOGGLE_ENABLED = false

const readStoredPreference = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === THEME_LIGHT || stored === THEME_DARK || stored === THEME_SYSTEM) {
      return stored
    }
  } catch {
    // ignore
  }
  return THEME_LIGHT
}

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(() =>
    THEME_TOGGLE_ENABLED ? readStoredPreference() : THEME_LIGHT,
  )

  useEffect(() => {
    const next = THEME_TOGGLE_ENABLED ? resolveTheme(preference) : THEME_LIGHT
    applyTheme(next)
    try {
      localStorage.setItem(
        THEME_STORAGE_KEY,
        THEME_TOGGLE_ENABLED ? preference : THEME_LIGHT,
      )
    } catch {
      // ignore
    }
  }, [preference])

  useEffect(() => {
    if (!THEME_TOGGLE_ENABLED || preference !== THEME_SYSTEM) return undefined

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(resolveTheme(THEME_SYSTEM))
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const setPreferenceSafe = (next) => {
    if (!THEME_TOGGLE_ENABLED) return
    setPreference(next)
  }

  const value = {
    preference: THEME_TOGGLE_ENABLED ? preference : THEME_LIGHT,
    resolved: THEME_TOGGLE_ENABLED ? resolveTheme(preference) : THEME_LIGHT,
    setPreference: setPreferenceSafe,
    setLight: () => setPreferenceSafe(THEME_LIGHT),
    setDark: () => setPreferenceSafe(THEME_DARK),
    setSystem: () => setPreferenceSafe(THEME_SYSTEM),
    toggle: () => {
      if (!THEME_TOGGLE_ENABLED) return
      setPreference((prev) =>
        resolveTheme(prev) === THEME_DARK ? THEME_LIGHT : THEME_DARK,
      )
    },
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
