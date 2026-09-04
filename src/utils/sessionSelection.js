import {
  ALL_DATES,
  clampIsoToToday,
  isAllDates,
  isIsoDate,
  normalizeEndDate,
} from './dateRange.js'

/** Session keys for site-scoped pages (balance / hajira / cash). */
export const SELECTED_SITE_KEY = 'selectedSite'
export const SELECTED_DATE_KEY = 'selectedDate'
export const SELECTED_START_DATE_KEY = 'selectedStartDate'
export const SELECTED_END_DATE_KEY = 'selectedEndDate'

export { todayIso, isIsoDate, toIsoDate } from './dateRange.js'

const readSession = (key) => {
  try {
    return sessionStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

const writeSession = (key, value) => {
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
  } catch {
    // ignore quota / private mode
  }
}

export const readSelectedSite = () => readSession(SELECTED_SITE_KEY)

export const writeSelectedSite = (siteId) =>
  writeSession(SELECTED_SITE_KEY, siteId ? String(siteId) : '')

/** Start date. Falls back to legacy `selectedDate`. */
export const readSelectedStartDate = () => {
  const start =
    readSession(SELECTED_START_DATE_KEY) || readSession(SELECTED_DATE_KEY)
  if (isAllDates(start)) return ALL_DATES
  return isIsoDate(start) ? clampIsoToToday(start) : ''
}

export const readSelectedEndDate = () => {
  const end = readSession(SELECTED_END_DATE_KEY)
  return isIsoDate(end) ? clampIsoToToday(end) : ''
}

/** @deprecated Use readSelectedStartDate. */
export const readSelectedDate = () => readSelectedStartDate()

export const writeSelectedDateRange = (start, end) => {
  if (isAllDates(start)) {
    writeSession(SELECTED_START_DATE_KEY, ALL_DATES)
    writeSession(SELECTED_DATE_KEY, ALL_DATES)
    writeSession(SELECTED_END_DATE_KEY, '')
    return
  }
  const nextStart = isIsoDate(start) ? clampIsoToToday(start) : ''
  const nextEnd = isIsoDate(end)
    ? normalizeEndDate(nextStart, clampIsoToToday(end))
    : null
  writeSession(SELECTED_START_DATE_KEY, nextStart)
  writeSession(SELECTED_DATE_KEY, nextStart)
  writeSession(SELECTED_END_DATE_KEY, nextEnd || '')
}

/** @deprecated Use writeSelectedDateRange. Single-day write. */
export const writeSelectedDate = (date) => writeSelectedDateRange(date, null)
