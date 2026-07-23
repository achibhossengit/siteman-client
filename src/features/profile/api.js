import { api } from '../../api/client.js'
import { endpoints } from '../../api/endpoints.js'

export const fetchProfile = () => api.get(endpoints.profile)

export const updateProfile = (payload) =>
  api.patch(endpoints.profile, payload)
