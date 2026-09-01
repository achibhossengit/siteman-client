import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { register as registerApi } from '../../api/auth.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { passwordCreateSchema } from '../../api/types/user.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { paths } from '../../router/paths.js'
import { bdPhoneNumberSchema, isBdPhoneNumber } from '../../utils/phone.js'
import {
  REGISTRATION_DISABLED,
  REGISTRATION_DISABLED_MESSAGE,
} from '../../config/features.js'

const schema = z
  .object({
    company_name: z.string().trim().min(2, 'কোম্পানির নাম দিন'),
    name: z.string().trim().min(2, 'নাম দিন'),
    phone_number: bdPhoneNumberSchema,
    password: passwordCreateSchema,
    confirm_password: z.string().min(1, 'পাসওয়ার্ড নিশ্চিত করুন'),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: 'পাসওয়ার্ড মিলছে না',
    path: ['confirm_password'],
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
      company_name: '',
      name: '',
      phone_number: '',
      password: '',
      confirm_password: '',
    },
  })

  const companyName = watch('company_name')
  const name = watch('name')
  const phoneNumber = watch('phone_number')
  const password = watch('password')
  const confirmPassword = watch('confirm_password')
  const canSubmit =
    (companyName?.trim()?.length ?? 0) >= 2 &&
    (name?.trim()?.length ?? 0) >= 2 &&
    isBdPhoneNumber(phoneNumber ?? '') &&
    passwordCreateSchema.safeParse(password ?? '').success &&
    (confirmPassword ?? '') === (password ?? '')

  const onSubmit = handleSubmit(async (values) => {
    if (REGISTRATION_DISABLED) return
    setApiError(null)
    const payload = {
      company_name: values.company_name,
      name: values.name,
      phone_number: values.phone_number,
      password: values.password,
    }
    try {
      await registerApi(payload)
      navigate(paths.login, { replace: true, state: { registered: true } })
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
          <span className="label-text mb-1">আপনার নাম</span>
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
            placeholder="০১XXXXXXXXX"
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
          <span className="label-text mb-1">পাসওয়ার্ড</span>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={20}
            className={`input input-bordered w-full ${errors.password ? 'input-error' : ''}`}
            placeholder="কমপক্ষে ৮ অক্ষর (শুধু সংখ্যা নয়)"
            disabled={REGISTRATION_DISABLED}
            {...register('password')}
          />
          {errors.password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.password.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">পাসওয়ার্ড নিশ্চিত করুন</span>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={20}
            className={`input input-bordered w-full ${errors.confirm_password ? 'input-error' : ''}`}
            placeholder="পাসওয়ার্ড আবার দিন"
            disabled={REGISTRATION_DISABLED}
            {...register('confirm_password')}
          />
          {errors.confirm_password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.confirm_password.message}
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
            'রেজিস্ট্রেশন করুন'
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
