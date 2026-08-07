import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { asList, asPage, fetchAllPages } from './pagination.js'

/** GET /users — filters: is_active, is_companyadmin, search. Paginated. */
export const fetchUsers = ({
  is_active,
  is_companyadmin,
  search,
  page,
  page_size,
  all = false,
} = {}) => {
  const params = {
    ...(typeof is_active === 'boolean' ? { is_active } : {}),
    ...(typeof is_companyadmin === 'boolean' ? { is_companyadmin } : {}),
    ...(search ? { search } : {}),
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }
  if (all) {
    return fetchAllPages((p, pageSize) =>
      api.get(endpoints.users.list, {
        params: { ...params, page: p, page_size: pageSize },
      }),
    ).then((results) => ({ data: results }))
  }
  return api.get(endpoints.users.list, { params }).then((res) => ({
    ...res,
    data:
      page != null || page_size != null ? asPage(res.data) : asList(res.data),
  }))
}

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
