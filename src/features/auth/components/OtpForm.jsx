import { useEffect, useMemo, useState } from 'react'
import { secondsUntil } from '../otpSession.js'

const pad = (n) => String(Math.max(0, n)).padStart(2, '0')

const formatSeconds = (total) => {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${pad(m)}:${pad(s)}`
}

/**
 * Countdown from absolute deadlines so refresh does not restart the timer.
 * @param {number} expiresAt - unix ms when OTP expires
 * @param {number} resendAt - unix ms when resend is allowed
 */
export const OtpForm = ({
  otp,
  onOtpChange,
  onSubmit,
  onResend,
  submitting = false,
  resending = false,
  expiresAt = 0,
  resendAt = 0,
  error = null,
  submitLabel = 'নিশ্চিত করুন',
  children = null,
}) => {
  const [expiresLeft, setExpiresLeft] = useState(() => secondsUntil(expiresAt))
  const [resendLeft, setResendLeft] = useState(() => secondsUntil(resendAt))

  useEffect(() => {
    setExpiresLeft(secondsUntil(expiresAt))
    setResendLeft(secondsUntil(resendAt))
  }, [expiresAt, resendAt])

  useEffect(() => {
    const id = window.setInterval(() => {
      setExpiresLeft(secondsUntil(expiresAt))
      setResendLeft(secondsUntil(resendAt))
    }, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt, resendAt])

  const canResend = useMemo(
    () => resendLeft <= 0 && !resending && !submitting,
    [resendLeft, resending, submitting],
  )

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      noValidate
    >
      {children}

      <label className="form-control w-full">
        <span className="label-text mb-1">OTP কোড</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className={`input input-bordered w-full tracking-[0.4em] text-center text-lg ${error ? 'input-error' : ''}`}
          placeholder="••••••"
          value={otp}
          onChange={(e) =>
            onOtpChange?.(e.target.value.replace(/\D/g, '').slice(0, 6))
          }
        />
        {error ? (
          <span className="label-text-alt text-error mt-1">{error}</span>
        ) : null}
      </label>

      <div className="flex justify-between text-xs text-base-content/70">
        <span>
          মেয়াদ:{' '}
          {expiresLeft > 0 ? formatSeconds(expiresLeft) : 'শেষ'}
        </span>
        <button
          type="button"
          className="link link-hover link-primary disabled:opacity-50"
          disabled={!canResend}
          onClick={() => onResend?.()}
        >
          {resending
            ? 'পাঠানো হচ্ছে…'
            : resendLeft > 0
              ? `আবার পাঠান (${formatSeconds(resendLeft)})`
              : 'আবার পাঠান'}
        </button>
      </div>

      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={submitting || otp.length !== 6}
      >
        {submitting ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          submitLabel
        )}
      </button>
    </form>
  )
}
