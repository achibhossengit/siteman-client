export const OTP_STORAGE = {
  register: 'siteman.register.otp',
  passwordReset: 'siteman.passwordReset.otp',
}

const otherOtpKey = (key) => {
  if (key === OTP_STORAGE.register) return OTP_STORAGE.passwordReset
  if (key === OTP_STORAGE.passwordReset) return OTP_STORAGE.register
  return null
}

/** Only one OTP flow may exist at a time — saving one clears the other. */
export const saveOtpSession = (key, payload) => {
  const other = otherOtpKey(key)
  if (other) sessionStorage.removeItem(other)

  const savedAt = Date.now()
  const next = {
    ...payload,
    savedAt,
  }
  sessionStorage.setItem(key, JSON.stringify(next))
  return next
}

export const readOtpSession = (key) => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ticket) return null
    return parsed
  } catch {
    return null
  }
}

export const clearOtpSession = (key) => {
  sessionStorage.removeItem(key)
}

/**
 * Ensure only one OTP session exists. Prefer the newer savedAt.
 * @returns {'register' | 'passwordReset' | null}
 */
export const getPendingOtpKind = () => {
  const register = readOtpSession(OTP_STORAGE.register)
  const passwordReset = readOtpSession(OTP_STORAGE.passwordReset)

  if (register && passwordReset) {
    if ((register.savedAt ?? 0) >= (passwordReset.savedAt ?? 0)) {
      clearOtpSession(OTP_STORAGE.passwordReset)
      return 'register'
    }
    clearOtpSession(OTP_STORAGE.register)
    return 'passwordReset'
  }
  if (register) return 'register'
  if (passwordReset) return 'passwordReset'
  return null
}

/** Absolute deadlines (ms) from session row. */
export const getOtpDeadlines = (session) => {
  const savedAt = session?.savedAt ?? Date.now()
  const expiresIn = session?.otp_expires_in ?? 300
  const cooldown = session?.resend_cooldown ?? 60
  return {
    expiresAt: savedAt + expiresIn * 1000,
    resendAt: savedAt + cooldown * 1000,
  }
}

export const secondsUntil = (deadlineMs) => {
  if (!deadlineMs) return 0
  return Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000))
}
