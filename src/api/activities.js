import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { asList, asPage, fetchAllPages } from './pagination.js'

/**
 * GET /api/v1/activities — always paginated in OpenAPI.
 * Pass `all: true` to walk pages (day/history style fetches).
 * Pass `page`/`page_size` for list UI.
 */
export const fetchActivities = ({
  site,
  business_date,
  business_date__gte,
  business_date__lte,
  entity_type,
  entity_id,
  reviewed,
  action,
  actor,
  labour,
  created_at__gte,
  created_at__lte,
  page,
  page_size,
  all = false,
} = {}) => {
  const params = {
    ...(site != null && site !== '' ? { site } : {}),
    ...(business_date ? { business_date } : {}),
    ...(business_date__gte ? { business_date__gte } : {}),
    ...(business_date__lte ? { business_date__lte } : {}),
    ...(entity_type ? { entity_type } : {}),
    ...(entity_id != null && entity_id !== '' ? { entity_id } : {}),
    ...(typeof reviewed === 'boolean' ? { reviewed } : {}),
    ...(action ? { action } : {}),
    ...(actor != null && actor !== '' ? { actor } : {}),
    ...(labour != null && labour !== '' ? { labour } : {}),
    ...(created_at__gte ? { created_at__gte } : {}),
    ...(created_at__lte ? { created_at__lte } : {}),
    ...(page != null ? { page } : {}),
    ...(page_size != null ? { page_size } : {}),
  }

  if (all) {
    return fetchAllPages((p, size) =>
      api.get(endpoints.activities.list, {
        params: { ...params, page: p, page_size: size },
      }),
    ).then((results) => ({ data: results }))
  }

  return api.get(endpoints.activities.list, { params }).then((res) => ({
    ...res,
    data: asPage(res.data),
  }))
}

/**
 * POST /api/v1/activities/review — mark one or more logs reviewed (one-way).
 * Accepts a single id or an array; already-reviewed rows are skipped server-side.
 */
export const reviewActivities = (ids, { review_note } = {}) => {
  const list = (Array.isArray(ids) ? ids : [ids])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id))
  return api.post(endpoints.activities.review, {
    ids: list,
    ...(review_note != null && review_note !== ''
      ? { review_note }
      : {}),
  })
}
