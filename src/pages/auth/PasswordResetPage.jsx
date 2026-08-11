import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { passwordReset } from '../../api/auth.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { paths } from '../../router/paths.js'
import { toastSuccess } from '../../utils/feedback.js'
import { OTP_STORAGE, saveOtpSession } from '../../utils/otpSession.js'
import { bdPhoneNumberSchema } from '../../utils/phone.js'

const schema = z.object({
  phone_number: bdPhoneNumberSchema,
})

export const PasswordResetPage = () => {
  const navigate = useNavigate()
  const [apiError, setApiError] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { phone_number: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await passwordReset(values)
      // Always proceed to OTP (ghost tickets for unknown phones)
      saveOtpSession(OTP_STORAGE.passwordReset, {
        ticket: data.ticket,
        otp_expires_in: data.otp_expires_in ?? 300,
        resend_cooldown: data.resend_cooldown ?? 60,
        phone_number: values.phone_number,
      })
      toastSuccess('OTP পাঠানো হয়েছে')
      navigate(paths.passwordResetConfirm)
    } catch (err) {
      const parsed = parseApiError(err)
      // Anti-enumeration: if somehow blocked, still try to continue only on success.
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <form className="card-body gap-3" onSubmit={onSubmit} noValidate>
        <h1 className="card-title justify-center text-2xl">পাসওয়ার্ড রিসেট</h1>
        <p className="text-center text-sm text-base-content/70 -mt-1">
        আপনার ইমেইল এ OTP যাবে। ইমেইল সেট করা না থাকলে পাসওয়ার্ড রিসেট করা সম্ভব নয়। 
        </p>

        <ApiErrorAlert error={apiError} />

        <label className="form-control w-full">
          <span className="label-text mb-1">ফোন নম্বর</span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={11}
            className={`input input-bordered w-full ${errors.phone_number ? 'input-error' : ''}`}
            placeholder="০১XXXXXXXXX"
            {...register('phone_number')}
          />
          {errors.phone_number ? (
            <span className="label-text-alt text-error mt-1">
              {errors.phone_number.message}
            </span>
          ) : null}
        </label>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            'OTP পাঠান'
          )}
        </button>

        <p className="text-center text-sm">
          <Link to={paths.login} className="link link-hover">
            লগইনে ফিরে যান
          </Link>
        </p>
      </form>
    </div>
  )
}
