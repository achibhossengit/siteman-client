import { api } from './client.js'
import { endpoints } from './endpoints.js'

/** PATCH /company — name and labour_transfer_allowed (`change_company`). */
export const updateCompany = (payload) => api.patch(endpoints.company, payload)

/** DELETE /company — password-confirmed hard delete (`delete_company`). */
export const deleteCompany = ({ password } = {}) =>
  api.delete(endpoints.company, {
    data: { password },
  })
