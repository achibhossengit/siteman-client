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
  { date, site, billing, is_sealed } = {},
) =>
  api.get(endpoints.labours.attendances(labourId), {
    params: {
      ...(date ? { date } : {}),
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
  { date, site, type, category, is_sealed } = {},
) =>
  api.get(endpoints.labours.payments(labourId), {
    params: {
      ...(date ? { date } : {}),
      ...(site != null && site !== '' ? { site } : {}),
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
      ...(typeof is_sealed === 'boolean' ? { is_sealed } : {}),
    },
  })

/** PATCH /labours/{labour_pk}/payments/{id} */
export const updateLabourPayment = (labourId, paymentId, payload) =>
  api.patch(endpoints.labours.paymentDetail(labourId, paymentId), payload)

/** DELETE /labours/{labour_pk}/payments/{id} */
export const deleteLabourPayment = (labourId, paymentId) =>
  api.delete(endpoints.labours.paymentDetail(labourId, paymentId))

/** GET /labours/{labour_pk}/sessions */
export const fetchLabourSessions = (labourId, params = {}) =>
  api.get(endpoints.labours.sessions(labourId), { params })

/** GET /labours/{labour_pk}/sessions/{id} */
export const fetchLabourSession = (labourId, sessionId) =>
  api.get(endpoints.labours.session(labourId, sessionId))

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
