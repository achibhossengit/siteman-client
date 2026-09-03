import { api } from './client.js'
import { endpoints } from './endpoints.js'

/** GET /company — entitlements, site catalog, and assignable groups. */
export const fetchCompany = () => api.get(endpoints.company)

/** PATCH /company — name and labour_transfer_allowed (`change_company`). */
export const updateCompany = (payload) => api.patch(endpoints.company, payload)

/** DELETE /company — password-confirmed hard delete (`delete_company`). */
export const deleteCompany = ({ password } = {}) =>
  api.delete(endpoints.company, {
    data: { password },
  })
