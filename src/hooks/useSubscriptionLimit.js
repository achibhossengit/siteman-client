import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchLabours } from '../api/labours.js'
import { fetchSites } from '../api/sites.js'
import { fetchUsers } from '../api/users.js'
import { useAuth } from '../providers/AuthProvider.jsx'
import { paths } from '../router/paths.js'
import { alertNotice, alertSubscriptionLimit } from '../utils/feedback.js'
import {
  getCompanyLimit,
  isSubscriptionLimitReached,
  SUBSCRIPTION_UPDATE_ASK_ADMIN,
} from '../utils/subscription.js'

const USAGE_FETCH = {
  user: () => fetchUsers({ is_active: true, page: 1, page_size: 1 }),
  labour: () => fetchLabours({ is_active: true, page: 1, page_size: 1 }),
  site: () =>
    fetchSites({ is_active: true, is_closed: false, page: 1, page_size: 1 }),
}

const USAGE_QUERY_KEY = {
  user: ['users', 'list', 'active-count'],
  labour: ['labours', 'list', 'active-count'],
  site: ['sites', 'list', 'active-count'],
}

/**
 * Gate create-FAB against `profile.company.active_*_limit` vs list `count`.
 * @param {'user' | 'labour' | 'site'} kind
 */
export const useSubscriptionLimit = (kind) => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canUpdatePlan = Boolean(profile?.is_companyadmin)
  const limit = getCompanyLimit(profile, kind)

  const usageQuery = useQuery({
    queryKey: USAGE_QUERY_KEY[kind],
    queryFn: async () => {
      const { data } = await USAGE_FETCH[kind]()
      return data.count ?? 0
    },
    enabled: limit != null,
  })

  const { data: usedCount, refetch } = usageQuery

  const assertCanCreate = useCallback(
    async (message) => {
      if (limit == null) return true
      let used = usedCount
      if (used == null) {
        const result = await refetch()
        used = result.data ?? 0
      }
      if (isSubscriptionLimitReached(used, limit)) {
        const goUpdate = await alertSubscriptionLimit(message)
        if (goUpdate) {
          if (canUpdatePlan) navigate(paths.companySettings)
          else await alertNotice({ text: SUBSCRIPTION_UPDATE_ASK_ADMIN })
        }
        return false
      }
      return true
    },
    [limit, usedCount, refetch, navigate, canUpdatePlan],
  )

  return { assertCanCreate, limit, used: usedCount }
}
