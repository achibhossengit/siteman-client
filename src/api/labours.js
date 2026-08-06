import { api } from './client.js'
import { endpoints } from './endpoints.js'

/** GET /labours — filters: current_site, is_active, search. */
export const fetchLabours = ({ current_site, is_active, search } = {}) =>
  api.get(endpoints.labours.list, {
    params: {
      ...(current_site != null && current_site !== ''
        ? { current_site }
        : {}),
      ...(typeof is_active === 'boolean' ? { is_active } : {}),
      ...(search ? { search } : {}),
    },
  })

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

/** GET /labours/{labour_pk}/attendances */
export const fetchLabourAttendancesByLabour = (
  labourId,
  { date, date__gte, date__lte, site, billing, is_sealed } = {},
) =>
  api.get(endpoints.labours.attendances(labourId), {
    params: {
      ...(date ? { date } : {}),
      ...(date__gte ? { date__gte } : {}),
      ...(date__lte ? { date__lte } : {}),
      ...(site != null && site !== '' ? { site } : {}),
      ...(billing != null && billing !== '' ? { billing } : {}),
      ...(typeof is_sealed === 'boolean' ? { is_sealed } : {}),
    },
  })

/** GET /labours/{labour_pk}/attendances/{id} */
export const fetchLabourAttendanceDetail = (labourId, attendanceId) =>
  api.get(endpoints.labours.attendanceDetail(labourId, attendanceId))

/** PATCH /labours/{labour_pk}/attendances/{id} */
export const updateLabourAttendance = (labourId, attendanceId, payload) =>
  api.patch(endpoints.labours.attendanceDetail(labourId, attendanceId), payload)

/** DELETE /labours/{labour_pk}/attendances/{id} */
export const deleteLabourAttendance = (labourId, attendanceId) =>
  api.delete(endpoints.labours.attendanceDetail(labourId, attendanceId))

/** GET /labours/{labour_pk}/payments */
export const fetchLabourPaymentsByLabour = (
  labourId,
  { date, date__gte, date__lte, site, type, is_sealed } = {},
) =>
  api.get(endpoints.labours.payments(labourId), {
    params: {
      ...(date ? { date } : {}),
      ...(date__gte ? { date__gte } : {}),
      ...(date__lte ? { date__lte } : {}),
      ...(site != null && site !== '' ? { site } : {}),
      ...(type ? { type } : {}),
      ...(typeof is_sealed === 'boolean' ? { is_sealed } : {}),
    },
  })

/** GET /labours/{labour_pk}/payments/{id} */
export const fetchLabourPaymentDetail = (labourId, paymentId) =>
  api.get(endpoints.labours.paymentDetail(labourId, paymentId))

/** PATCH /labours/{labour_pk}/payments/{id} */
export const updateLabourPayment = (labourId, paymentId, payload) =>
  api.patch(endpoints.labours.paymentDetail(labourId, paymentId), payload)

/** DELETE /labours/{labour_pk}/payments/{id} */
export const deleteLabourPayment = (labourId, paymentId) =>
  api.delete(endpoints.labours.paymentDetail(labourId, paymentId))

/** GET /labours/{labour_pk}/sessions */
export const fetchLabourSessions = (labourId, params = {}) =>
  api.get(endpoints.labours.sessions(labourId), { params })

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
