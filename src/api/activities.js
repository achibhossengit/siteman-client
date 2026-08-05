import { api } from './client.js'
import { endpoints } from './endpoints.js'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

const asPage = (data) => {
  const results = asList(data)
  return {
    results,
    count: typeof data?.count === 'number' ? data.count : results.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
  }
}

/**
 * GET /api/v1/activities
 * - Day-review: paginate=false → data is ActivityLog[]
 * - List page: omit paginate / paginate=true → data is { results, count, next, previous }
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
  paginate = false,
  page,
  page_size,
} = {}) =>
  api
    .get(endpoints.activities.list, {
      params: {
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
        ...(paginate === false ? { paginate: false } : {}),
        ...(page != null ? { page } : {}),
        ...(page_size != null ? { page_size } : {}),
      },
    })
    .then((res) => ({
      ...res,
      data: paginate === false ? asList(res.data) : asPage(res.data),
    }))

/** PATCH /api/v1/activities/{id}/review — one-way mark reviewed. */
export const reviewActivity = (id, payload = {}) =>
  api.patch(endpoints.activities.review(id), payload)

/** POST /api/v1/activities/review-bulk — { ids: number[] } */
export const reviewActivitiesBulk = (ids) =>
  api.post(endpoints.activities.reviewBulk, {
    ids: (ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id)),
  })
