import { api } from './client.js'
import { endpoints } from './endpoints.js'

/**
 * Day summary for a site.
 * OpenAPI documents 200 as `Site` (incorrect) — live shape is aggregates.
 * Always send `date` (YYYY-MM-DD).
 */
export const fetchDailyReport = (siteId, date) =>
  api.get(endpoints.sites.dailyReports(siteId), {
    params: { date },
  })
