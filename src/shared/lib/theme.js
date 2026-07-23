export const THEME_STORAGE_KEY = 'siteman-theme'
export const THEME_LIGHT = 'siteman'
export const THEME_DARK = 'siteman-dark'
export const THEME_SYSTEM = 'system'

export const getSystemTheme = () => {
  if (typeof window === 'undefined') return THEME_LIGHT
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? THEME_DARK
    : THEME_LIGHT
}

export const resolveTheme = (preference) => {
  if (preference === THEME_SYSTEM) return getSystemTheme()
  if (preference === THEME_DARK) return THEME_DARK
  return THEME_LIGHT
}

export const applyTheme = (themeName) => {
  document.documentElement.setAttribute('data-theme', themeName)
}
