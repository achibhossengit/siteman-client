import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { asList, asPage, fetchAllPages } from './pagination.js'

/** GET /labours — filters: current_site, is_active, search. Paginated.
 * `current_site: 'unassigned'` → labours with no site (null).
 */
export const fetchLabours = ({
  current_site,
  is_active,
  search,
  page,
  page_size,
} = {}) => {
  const params = {
    ...(typeof is_active === 'boolean' ? { is_active } : {}),
    ...(search ? { search } : {}),
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  if (current_site === 'unassigned') {
    // Backend treats the string "null" as current_site IS NULL.
    params.current_site = 'null'
  } else if (
    current_site != null &&
    current_site !== '' &&
    current_site !== 'all'
  ) {
    params.current_site = current_site
  }
  return api.get(endpoints.labours.list, { params }).then((res) => ({
    ...res,
    data:
      page != null || page_size != null ? asPage(res.data) : asList(res.data),
  }))
}

/**
 * Active labours assigned to a site.
 * GET /labours?current_site={id}&is_active=true (all pages).
 */
export const fetchSiteActiveLabour = async (siteId) => {
  const data = await fetchAllPages(({ page, page_size }) =>
    fetchLabours({
      current_site: siteId,
      is_active: true,
      page,
      page_size,
    }),
  )
  return { data }
}

/** GET /labours/{id} */
export const fetchLabourDetail = (labourId) =>
  api.get(endpoints.labours.detail(labourId))

/** POST /labours */
export const createLabour = (payload) =>
  api.post(endpoints.labours.list, payload)

/** PATCH /labours/{id} */
export const updateLabour = (labourId, payload) =>
  api.patch(endpoints.labours.detail(labourId), payload)

/** DELETE /labours/{id} */
export const deleteLabour = (labourId) =>
  api.delete(endpoints.labours.detail(labourId))

/**
 * GET /labours/{labour_pk}/daily-records — filters: date range, site, billing, is_sealed.
 * Paginated.
 */
export const fetchLabourDailyRecords = (
  labourId,
  {
    date,
    date__gte,
    date__lte,
    site,
    billing,
    is_sealed,
    page,
    page_size,
  } = {},
) => {
  const params = {
    ...(date ? { date } : {}),
    ...(date__gte ? { date__gte } : {}),
    ...(date__lte ? { date__lte } : {}),
    ...(site != null && site !== '' ? { site } : {}),
    ...(billing != null && billing !== '' ? { billing } : {}),
    ...(typeof is_sealed === 'boolean' ? { is_sealed } : {}),
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  return api
    .get(endpoints.labours.dailyRecords(labourId), { params })
    .then((res) => ({
      ...res,
      data:
        page != null || page_size != null ? asPage(res.data) : asList(res.data),
    }))
}

/** GET /labours/{labour_pk}/daily-records/{id} */
export const fetchLabourDailyRecordDetail = (labourId, recordId) =>
  api.get(endpoints.labours.dailyRecordDetail(labourId, recordId))

/** PATCH /labours/{labour_pk}/daily-records/{id} */
export const updateLabourDailyRecord = (labourId, recordId, payload) =>
  api.patch(endpoints.labours.dailyRecordDetail(labourId, recordId), payload)

/** DELETE /labours/{labour_pk}/daily-records/{id} */
export const deleteLabourDailyRecord = (labourId, recordId) =>
  api.delete(endpoints.labours.dailyRecordDetail(labourId, recordId))

/** GET /labours/{labour_pk}/sessions — paginated. */
export const fetchLabourSessions = (
  labourId,
  { page, page_size, ...rest } = {},
) => {
  const params = {
    ...rest,
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  return api
    .get(endpoints.labours.sessions(labourId), { params })
    .then((res) => ({
      ...res,
      data:
        page != null || page_size != null ? asPage(res.data) : asList(res.data),
    }))
}

/** POST /labours/{labour_pk}/sessions — close the open period (no payload). */
export const closeLabourSession = (labourId) =>
  api.post(endpoints.labours.sessions(labourId))

/** GET /labours/{labour_pk}/sessions/{id} */
export const fetchLabourSession = (labourId, sessionId) =>
  api.get(endpoints.labours.session(labourId, sessionId))

/** DELETE /labours/{labour_pk}/sessions/{id} — latest session only. */
export const deleteLabourSession = (labourId, sessionId) =>
  api.delete(endpoints.labours.session(labourId, sessionId))

/**
 * GET /labours/{labour_pk}/sessions/running_session
 * Returns null when there is no open period (404).
 */
export const fetchLabourRunningSession = async (labourId) => {
  try {
    return await api.get(endpoints.labours.runningSession(labourId))
  } catch (err) {
    if (err?.response?.status === 404) return { data: null }
    throw err
  }
}

/**
 * GET /labours/{labour_pk}/sessions/latest_session
 * Returns null when no sealed session exists (404).
 */
export const fetchLabourLatestSession = async (labourId) => {
  try {
    return await api.get(endpoints.labours.latestSession(labourId))
  } catch (err) {
    if (err?.response?.status === 404) return { data: null }
    throw err
  }
}
