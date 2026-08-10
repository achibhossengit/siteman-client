import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { register as registerApi } from '../../api/auth.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { paths } from '../../router/paths.js'
import { toastSuccess } from '../../utils/feedback.js'
import { OTP_STORAGE, saveOtpSession } from '../../utils/otpSession.js'
import {
  REGISTRATION_DISABLED,
  REGISTRATION_DISABLED_MESSAGE,
} from '../../config/features.js'

const schema = z.object({
  name: z.string().min(2, 'নাম দিন'),
  phone_number: z
    .string()
    .regex(/^\d{11}$/, '১১ ডিজিটের ফোন নম্বর দিন'),
  email: z.string().trim().email('সঠিক ইমেইল দিন'),
  company_name: z.string().min(2, 'কোম্পানির নাম দিন'),
  password: z
    .string()
    .min(6, 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড')
    .max(20, 'পাসওয়ার্ড সর্বোচ্চ ২০ অক্ষরের হতে পারে'),
})

export const RegisterPage = () => {
  const navigate = useNavigate()
  const [apiError, setApiError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone_number: '',
      email: '',
      company_name: '',
      password: '',
    },
  })

  const phoneNumber = watch('phone_number')
  const password = watch('password')
  const canSubmit =
    /^\d{11}$/.test(phoneNumber ?? '') &&
    (password?.length ?? 0) >= 6 &&
    (password?.length ?? 0) <= 20

  const onSubmit = handleSubmit(async (values) => {
    if (REGISTRATION_DISABLED) return
    setApiError(null)
    const payload = {
      name: values.name,
      phone_number: values.phone_number,
      email: values.email.trim(),
      company_name: values.company_name,
      password: values.password,
    }
    try {
      const { data } = await registerApi(payload)
      saveOtpSession(OTP_STORAGE.register, {
        ticket: data.ticket,
        otp_expires_in: data.otp_expires_in ?? 300,
        resend_cooldown: data.resend_cooldown ?? 60,
        email: payload.email,
        phone_number: values.phone_number,
      })
      toastSuccess('ইমেইলে OTP পাঠানো হয়েছে')
      navigate(paths.registerConfirm)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <form className="card-body gap-3" onSubmit={onSubmit} noValidate>
        <h1 className="card-title justify-center text-xl">রেজিস্ট্রেশন করুন</h1>
        {REGISTRATION_DISABLED ? (
          <div role="status" className="alert alert-warning">
            <span>{REGISTRATION_DISABLED_MESSAGE}</span>
          </div>
        ) : null}

        <ApiErrorAlert error={apiError} />

        <label className="form-control w-full">
          <span className="label-text mb-1">নাম</span>
          <input
            className={`input input-bordered w-full ${errors.name ? 'input-error' : ''}`}
            placeholder="আপনার নাম দিন"
            disabled={REGISTRATION_DISABLED}
            {...register('name')}
          />
          {errors.name ? (
            <span className="label-text-alt text-error mt-1">
              {errors.name.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">ফোন নম্বর</span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={11}
            className={`input input-bordered w-full ${errors.phone_number ? 'input-error' : ''}`}
            placeholder="১১ ডিজিটের ফোন নম্বর দিন"
            disabled={REGISTRATION_DISABLED}
            {...register('phone_number')}
          />
          {errors.phone_number ? (
            <span className="label-text-alt text-error mt-1">
              {errors.phone_number.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">ইমেইল</span>
          <input
            type="email"
            className={`input input-bordered w-full ${errors.email ? 'input-error' : ''}`}
            placeholder="ইমেইল ঠিকানা দিন"
            disabled={REGISTRATION_DISABLED}
            {...register('email')}
          />
          {errors.email ? (
            <span className="label-text-alt text-error mt-1">
              {errors.email.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">কোম্পানির নাম</span>
          <input
            className={`input input-bordered w-full ${errors.company_name ? 'input-error' : ''}`}
            placeholder="কোম্পানির নাম দিন"
            disabled={REGISTRATION_DISABLED}
            {...register('company_name')}
          />
          {errors.company_name ? (
            <span className="label-text-alt text-error mt-1">
              {errors.company_name.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">পাসওয়ার্ড</span>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={20}
            className={`input input-bordered w-full ${errors.password ? 'input-error' : ''}`}
            placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন"
            disabled={REGISTRATION_DISABLED}
            {...register('password')}
          />
          {errors.password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.password.message}
            </span>
          ) : null}
        </label>

        <div className="flex items-center justify-start text-sm">
          <button
            type="button"
            className="link link-hover text-base-content/70"
            disabled={REGISTRATION_DISABLED}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
          </button>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={REGISTRATION_DISABLED || !canSubmit || isSubmitting}
        >
          {isSubmitting ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            'OTP পাঠান'
          )}
        </button>

        <p className="text-center text-sm">
          অ্যাকাউন্ট আছে?{' '}
          <Link to={paths.login} className="link link-primary">
            লগইন
          </Link>
        </p>
      </form>
    </div>
  )
}
