import { api } from './client.js'
import { endpoints } from './endpoints.js'

export const fetchProfile = () => api.get(endpoints.profile)

export const updateProfile = (payload) =>
  api.patch(endpoints.profile, payload)
