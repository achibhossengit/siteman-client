export const OTP_STORAGE = {
  register: 'siteman.register.otp',
  passwordReset: 'siteman.passwordReset.otp',
}

export const saveOtpSession = (key, payload) => {
  sessionStorage.setItem(
    key,
    JSON.stringify({
      ...payload,
      savedAt: Date.now(),
    }),
  )
}

export const readOtpSession = (key) => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const clearOtpSession = (key) => {
  sessionStorage.removeItem(key)
}
