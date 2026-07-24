/** Session keys for site-scoped pages (balance / hajira / cash). */
export const SELECTED_SITE_KEY = 'selectedSite'
export const SELECTED_DATE_KEY = 'selectedDate'

export const todayIso = () => new Date().toISOString().slice(0, 10)

export const readSelectedSite = () => {
  try {
    return sessionStorage.getItem(SELECTED_SITE_KEY) || ''
  } catch {
    return ''
  }
}

export const writeSelectedSite = (siteId) => {
  try {
    if (siteId) sessionStorage.setItem(SELECTED_SITE_KEY, String(siteId))
    else sessionStorage.removeItem(SELECTED_SITE_KEY)
  } catch {
    // ignore quota / private mode
  }
}

export const readSelectedDate = () => {
  try {
    return sessionStorage.getItem(SELECTED_DATE_KEY) || ''
  } catch {
    return ''
  }
}

export const writeSelectedDate = (date) => {
  try {
    if (date) sessionStorage.setItem(SELECTED_DATE_KEY, date)
    else sessionStorage.removeItem(SELECTED_DATE_KEY)
  } catch {
    // ignore
  }
}
