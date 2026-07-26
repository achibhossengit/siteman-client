import { api } from './client.js'
import { endpoints } from './endpoints.js'

/** GET /users — filters: is_active, is_companyadmin, search. */
export const fetchUsers = ({ is_active, is_companyadmin, search } = {}) =>
  api.get(endpoints.users.list, {
    params: {
      ...(typeof is_active === 'boolean' ? { is_active } : {}),
      ...(typeof is_companyadmin === 'boolean' ? { is_companyadmin } : {}),
      ...(search ? { search } : {}),
    },
  })

/** GET /users/{id} */
export const fetchUserDetail = (userId) =>
  api.get(endpoints.users.detail(userId))

/** POST /users — create (password system-generated). */
export const createUser = (payload) => api.post(endpoints.users.list, payload)

/** PATCH /users/{id} */
export const updateUser = (userId, payload) =>
  api.patch(endpoints.users.detail(userId), payload)

/** DELETE /users/{id} */
export const deleteUser = (userId) => api.delete(endpoints.users.detail(userId))
