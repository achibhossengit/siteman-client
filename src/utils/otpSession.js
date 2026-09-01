export const OTP_STORAGE = {
  passwordReset: 'siteman.passwordReset.otp',
}

const STALE_REGISTER_OTP_KEY = 'siteman.register.otp'

export const saveOtpSession = (key, payload) => {
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
 * @returns {'passwordReset' | null}
 */
export const getPendingOtpKind = () => {
  sessionStorage.removeItem(STALE_REGISTER_OTP_KEY)
  if (readOtpSession(OTP_STORAGE.passwordReset)) return 'passwordReset'
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
