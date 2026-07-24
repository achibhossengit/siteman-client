export const OTP_STORAGE = {
  register: 'siteman.register.otp',
  passwordReset: 'siteman.passwordReset.otp',
}

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
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const clearOtpSession = (key) => {
  sessionStorage.removeItem(key)
}

/** Seconds left until savedAt + durationSec. */
export const remainingSeconds = (savedAt, durationSec) => {
  if (!savedAt || durationSec == null) return 0
  const endsAt = Number(savedAt) + Number(durationSec) * 1000
  return Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
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
