import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { bindAuthTokenAccessors } from '../api/client.js'
import * as authApi from '../api/auth.js'
import * as companyApi from '../api/company.js'
import * as profileApi from '../api/profile.js'
import {
  clearAccessToken,
  readAccessToken,
  writeAccessToken,
} from '../utils/authToken.js'
import { MAINTENANCE } from '../config/features.js'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient()
  const [accessToken, setAccessTokenState] = useState(() => readAccessToken())
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  const setAccessToken = useCallback((token) => {
    writeAccessToken(token)
    setAccessTokenState(token)
  }, [])

  const clearSession = useCallback(() => {
    clearAccessToken()
    setAccessTokenState(null)
    setProfile(null)
    setCompany(null)
    queryClient.removeQueries({ queryKey: ['sites'] })
  }, [queryClient])

  useEffect(() => {
    bindAuthTokenAccessors({
      getToken: readAccessToken,
      setToken: setAccessToken,
      onFailure: clearSession,
    })
  }, [setAccessToken, clearSession])

  const refreshProfile = useCallback(async () => {
    const { data } = await profileApi.fetchProfile()
    setProfile(data)
    return data
  }, [])

  const refreshCompany = useCallback(async () => {
    const { data } = await companyApi.fetchCompany()
    setCompany(data)
    return data
  }, [])

  const bootstrapProfile = useCallback(async () => {
    const [nextProfile] = await Promise.all([
      refreshProfile(),
      refreshCompany(),
    ])
    return nextProfile
  }, [refreshProfile, refreshCompany])

  const refreshSession = useCallback(async () => {
    const { data } = await authApi.refreshToken()
    if (data?.access) setAccessToken(data.access)
    return data
  }, [setAccessToken])

  const login = useCallback(
    async ({ phone_number, password }) => {
      const { data } = await authApi.obtainToken({ phone_number, password })
      if (!data?.access) throw new Error('No access token')
      setAccessToken(data.access)
      const nextProfile = await bootstrapProfile()
      return { tokens: data, profile: nextProfile }
    },
    [setAccessToken, bootstrapProfile],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.blacklistToken()
    } catch {
      // still clear local session
    } finally {
      clearSession()
    }
  }, [clearSession])

  const changePassword = useCallback(
    async ({ current_password, new_password }) => {
      const { data } = await authApi.passwordChange({
        current_password,
        new_password,
      })
      if (data?.access) {
        setAccessToken(data.access)
      } else {
        await refreshSession()
      }
      return data
    },
    [setAccessToken, refreshSession],
  )

  useEffect(() => {
    if (MAINTENANCE) {
      setBootstrapping(false)
      return
    }

    let cancelled = false

    const bootstrap = async () => {
      try {
        // Prefer the stored access token; only hit refresh when none exists.
        // Expired access is handled by the API 401 → refresh interceptor.
        if (!readAccessToken()) {
          await refreshSession()
          if (cancelled) return
        }

        await bootstrapProfile()
        if (cancelled) return
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [refreshSession, bootstrapProfile, clearSession])

  const value = useMemo(
    () => ({
      accessToken,
      isAuthenticated: Boolean(accessToken),
      profile,
      setProfile,
      company,
      setCompany,
      bootstrapping,
      login,
      logout,
      refreshSession,
      bootstrapProfile,
      refreshProfile,
      refreshCompany,
      changePassword,
      clearSession,
      setAccessToken,
    }),
    [
      accessToken,
      profile,
      company,
      bootstrapping,
      login,
      logout,
      refreshSession,
      bootstrapProfile,
      refreshProfile,
      refreshCompany,
      changePassword,
      clearSession,
      setAccessToken,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
