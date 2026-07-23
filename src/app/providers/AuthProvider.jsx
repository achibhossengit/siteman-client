import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { bindAuthTokenAccessors } from '../../api/client.js'
import * as authApi from '../../features/auth/api.js'
import * as profileApi from '../../features/profile/api.js'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const accessTokenRef = useRef(null)
  const [accessToken, setAccessTokenState] = useState(null)
  const [profile, setProfile] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  const setAccessToken = useCallback((token) => {
    accessTokenRef.current = token
    setAccessTokenState(token)
  }, [])

  const clearSession = useCallback(() => {
    accessTokenRef.current = null
    setAccessTokenState(null)
    setProfile(null)
  }, [])

  useEffect(() => {
    bindAuthTokenAccessors({
      getToken: () => accessTokenRef.current,
      setToken: setAccessToken,
      onFailure: clearSession,
    })
  }, [setAccessToken, clearSession])

  const bootstrapProfile = useCallback(async () => {
    const { data } = await profileApi.fetchProfile()
    setProfile(data)
    return data
  }, [])

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
    let cancelled = false

    const bootstrap = async () => {
      try {
        await refreshSession()
        if (cancelled) return
        await bootstrapProfile()
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
      bootstrapping,
      login,
      logout,
      refreshSession,
      bootstrapProfile,
      changePassword,
      clearSession,
      setAccessToken,
    }),
    [
      accessToken,
      profile,
      bootstrapping,
      login,
      logout,
      refreshSession,
      bootstrapProfile,
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
