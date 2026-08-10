export const THEME_STORAGE_KEY = 'siteman-theme'
export const THEME_LIGHT = 'siteman'
export const THEME_DARK = 'siteman-dark'
export const THEME_SYSTEM = 'system'

/** Match AppHeader `bg-base-100` for the mobile browser/status bar. */
export const THEME_COLOR_LIGHT = '#fafafa'
export const THEME_COLOR_DARK = '#1c1b20'

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

export const applyThemeColor = (themeName) => {
  const color =
    themeName === THEME_DARK ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', color)
}

export const applyTheme = (themeName) => {
  document.documentElement.setAttribute('data-theme', themeName)
  applyThemeColor(themeName)
}
