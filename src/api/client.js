import axios from 'axios'
import { API_BASE, endpoints } from './endpoints.js'

/** @type {() => string | null} */
let getAccessToken = () => null
/** @type {(token: string | null) => void} */
let setAccessToken = () => {}
/** @type {(() => void) | null} */
let onAuthFailure = null

let refreshPromise = null

export const bindAuthTokenAccessors = ({ getToken, setToken, onFailure }) => {
  getAccessToken = getToken
  setAccessToken = setToken
  onAuthFailure = onFailure ?? null
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Default JSON Content-Type breaks multipart file uploads (boundary).
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const headers = config.headers
    if (headers && typeof headers.delete === 'function') {
      headers.delete('Content-Type')
    } else if (headers) {
      delete headers['Content-Type']
      delete headers['content-type']
    }
  }
  return config
})

const isAuthTokenUrl = (url = '') =>
  url.includes(endpoints.auth.tokenObtain) ||
  url.includes(endpoints.auth.tokenRefresh) ||
  url.includes(endpoints.auth.tokenBlacklist)

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post(endpoints.auth.tokenRefresh, {})
      .then((res) => {
        const access = res.data?.access
        if (!access) throw new Error('No access token in refresh response')
        setAccessToken(access)
        return access
      })
      .catch((err) => {
        setAccessToken(null)
        onAuthFailure?.()
        throw err
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (!original || error.response?.status !== 401) {
      return Promise.reject(error)
    }
    if (original._retry || isAuthTokenUrl(original.url || '')) {
      return Promise.reject(error)
    }

    original._retry = true
    try {
      const access = await refreshAccessToken()
      original.headers = original.headers ?? {}
      original.headers.Authorization = `Bearer ${access}`
      return api(original)
    } catch {
      return Promise.reject(error)
    }
  },
)

export const refreshSessionRequest = () => refreshAccessToken()
