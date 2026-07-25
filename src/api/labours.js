import { api } from './client.js'
import { endpoints } from './endpoints.js'

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
