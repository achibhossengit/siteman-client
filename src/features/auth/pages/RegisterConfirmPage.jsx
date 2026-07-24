import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { registerConfirm, registerResendOtp } from '../api.js'
import { parseApiError, messageForCode } from '../../../api/errors.js'
import { ApiErrorAlert } from '../../../shared/components/ApiErrorAlert.jsx'
import { OtpForm } from '../components/OtpForm.jsx'
import { paths } from '../../../app/router/paths.js'
import {
  OTP_STORAGE,
  clearOtpSession,
  getOtpDeadlines,
  readOtpSession,
  saveOtpSession,
} from '../otpSession.js'

export const RegisterConfirmPage = () => {
  const navigate = useNavigate()
  const session = readOtpSession(OTP_STORAGE.register)
  const initialDeadlines = getOtpDeadlines(session)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [expiresAt, setExpiresAt] = useState(initialDeadlines.expiresAt)
  const [resendAt, setResendAt] = useState(initialDeadlines.resendAt)

  if (!session?.ticket) {
    return <Navigate to={paths.register} replace />
  }

  const onSubmit = async () => {
    setApiError(null)
    setOtpError(null)
    setSubmitting(true)
    try {
      await registerConfirm({ ticket: session.ticket, otp })
      clearOtpSession(OTP_STORAGE.register)
      navigate(paths.login, { replace: true, state: { registered: true } })
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      if (parsed.hasCode?.('already_registered')) {
        setOtpError(messageForCode('already_registered'))
      } else if (parsed.fieldErrors?.otp) {
        setOtpError(parsed.fieldErrors.otp[0])
      } else if (parsed.errors?.[0]?.code) {
        setOtpError(
          messageForCode(parsed.errors[0].code, parsed.errors[0].detail),
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const onResend = async () => {
    setApiError(null)
    setResending(true)
    try {
      const { data } = await registerResendOtp({ ticket: session.ticket })
      const saved = saveOtpSession(OTP_STORAGE.register, {
        ...session,
        ticket: data.ticket || session.ticket,
        otp_expires_in: data.otp_expires_in ?? 300,
        resend_cooldown: data.resend_cooldown ?? 60,
      })
      const next = getOtpDeadlines(saved)
      setExpiresAt(next.expiresAt)
      setResendAt(next.resendAt)
      setOtp('')
    } catch (err) {
      setApiError(parseApiError(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body gap-3">
        <h1 className="card-title justify-center text-2xl">OTP নিশ্চিতকরণ</h1>
        <p className="text-center text-sm text-base-content/70 -mt-1">
          {session.phone_number
            ? `${session.phone_number} এ পাঠানো কোড দিন`
            : 'পাঠানো OTP কোড দিন'}
        </p>

        <ApiErrorAlert error={apiError} />

        <OtpForm
          otp={otp}
          onOtpChange={setOtp}
          onSubmit={onSubmit}
          onResend={onResend}
          submitting={submitting}
          resending={resending}
          expiresAt={expiresAt}
          resendAt={resendAt}
          error={otpError}
          submitLabel="নিবন্ধন সম্পন্ন"
        />

        <p className="text-center text-sm">
          <Link
            to={paths.register}
            className="link link-hover"
            onClick={() => clearOtpSession(OTP_STORAGE.register)}
          >
            বাতিল / ফিরে যান
          </Link>
        </p>
      </div>
    </div>
  )
}
