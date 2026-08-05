import { api } from './client.js'
import { endpoints } from './endpoints.js'

const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

/**
 * GET /api/v1/activities
 * Day-review: pass paginate=false with site + business_date + entity_type.
 */
export const fetchActivities = ({
  site,
  business_date,
  entity_type,
  reviewed,
  action,
  labour,
  paginate = false,
  page,
  page_size,
} = {}) =>
  api
    .get(endpoints.activities.list, {
      params: {
        ...(site != null && site !== '' ? { site } : {}),
        ...(business_date ? { business_date } : {}),
        ...(entity_type ? { entity_type } : {}),
        ...(typeof reviewed === 'boolean' ? { reviewed } : {}),
        ...(action ? { action } : {}),
        ...(labour != null && labour !== '' ? { labour } : {}),
        ...(paginate === false ? { paginate: false } : {}),
        ...(page != null ? { page } : {}),
        ...(page_size != null ? { page_size } : {}),
      },
    })
    .then((res) => ({
      ...res,
      data: asList(res.data),
    }))

/** PATCH /api/v1/activities/{id}/review — one-way mark reviewed. */
export const reviewActivity = (id, payload = {}) =>
  api.patch(endpoints.activities.review(id), payload)

/** POST /api/v1/activities/review-bulk — { ids: number[] } */
export const reviewActivitiesBulk = (ids) =>
  api.post(endpoints.activities.reviewBulk, {
    ids: (ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id)),
  })
