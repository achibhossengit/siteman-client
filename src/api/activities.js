import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { asPage } from './pagination.js'

/**
 * GET /api/v1/activities — paginated.
 * Pass `page` / `page_size` for list UI and history panels.
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

  return api.get(endpoints.activities.list, { params }).then((res) => ({
    ...res,
    data: asPage(res.data),
  }))
}

/**
 * Walk paginated GET /api/v1/activities until `next` is null.
 */
export const fetchAllActivities = async (filters = {}) => {
  const pageSize = filters.page_size ?? 100
  const results = []
  let page = 1

  for (;;) {
    const { data } = await fetchActivities({
      ...filters,
      page,
      page_size: pageSize,
    })
    results.push(...(data.results ?? []))
    if (!data.next) break
    page += 1
    if (page > 200) break
  }

  return results
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
