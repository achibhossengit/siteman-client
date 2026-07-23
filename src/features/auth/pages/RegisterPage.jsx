import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { register as registerApi } from '../api.js'
import { parseApiError, applyFieldErrors } from '../../../api/errors.js'
import { ApiErrorAlert } from '../../../shared/components/ApiErrorAlert.jsx'
import { paths } from '../../../app/router/paths.js'
import { OTP_STORAGE, saveOtpSession } from '../otpSession.js'

const schema = z.object({
  name: z.string().min(2, 'নাম দিন'),
  phone_number: z.string().min(8, 'ফোন নম্বর দিন'),
  email: z
    .string()
    .email('সঠিক ইমেইল দিন')
    .optional()
    .or(z.literal('')),
  company_name: z.string().min(2, 'কোম্পানির নাম দিন'),
  password: z.string().min(6, 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড'),
  channel: z.enum(['sms', 'email']),
})

export const RegisterPage = () => {
  const navigate = useNavigate()
  const [apiError, setApiError] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone_number: '',
      email: '',
      company_name: '',
      password: '',
      channel: 'sms',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null)
    const payload = {
      ...values,
      email: values.email || undefined,
    }
    try {
      const { data } = await registerApi(payload)
      saveOtpSession(OTP_STORAGE.register, {
        ticket: data.ticket,
        otp_expires_in: data.otp_expires_in ?? 300,
        resend_cooldown: data.resend_cooldown ?? 60,
        phone_number: values.phone_number,
      })
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
        <h1 className="card-title justify-center text-2xl">নিবন্ধন</h1>
        <p className="text-center text-sm text-base-content/70 -mt-1">
          কোম্পানি অ্যাকাউন্ট তৈরি করুন
        </p>

        <ApiErrorAlert error={apiError} />

        <label className="form-control w-full">
          <span className="label-text mb-1">নাম</span>
          <input
            className={`input input-bordered w-full ${errors.name ? 'input-error' : ''}`}
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
            className={`input input-bordered w-full ${errors.phone_number ? 'input-error' : ''}`}
            placeholder="+8801..."
            {...register('phone_number')}
          />
          {errors.phone_number ? (
            <span className="label-text-alt text-error mt-1">
              {errors.phone_number.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">ইমেইল (ঐচ্ছিক)</span>
          <input
            type="email"
            className={`input input-bordered w-full ${errors.email ? 'input-error' : ''}`}
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
            type="password"
            autoComplete="new-password"
            className={`input input-bordered w-full ${errors.password ? 'input-error' : ''}`}
            {...register('password')}
          />
          {errors.password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.password.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">OTP চ্যানেল</span>
          <select className="select select-bordered w-full" {...register('channel')}>
            <option value="sms">SMS</option>
            <option value="email">ইমেইল</option>
          </select>
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
          অ্যাকাউন্ট আছে?{' '}
          <Link to={paths.login} className="link link-primary">
            লগইন
          </Link>
        </p>
      </form>
    </div>
  )
}
