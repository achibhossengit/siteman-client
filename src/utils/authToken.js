/** Access JWT — tab-scoped (clears when the browser tab/window closes). */
export const ACCESS_TOKEN_KEY = 'siteman.accessToken'

export const readAccessToken = () => {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) || null
  } catch {
    return null
  }
}

export const writeAccessToken = (token) => {
  try {
    if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, String(token))
    else sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch {
    // ignore quota / private mode
  }
}

export const clearAccessToken = () => {
  writeAccessToken(null)
}
