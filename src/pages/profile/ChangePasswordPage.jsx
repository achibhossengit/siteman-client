import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { paths } from '../../router/paths.js'

const schema = z
  .object({
    current_password: z.string().min(1, 'বর্তমান পাসওয়ার্ড দিন'),
    new_password: z.string().min(6, 'কমপক্ষে ৬ অক্ষর'),
    confirm_password: z.string().min(6, 'পাসওয়ার্ড নিশ্চিত করুন'),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: 'পাসওয়ার্ড মিলছে না',
    path: ['confirm_password'],
  })

export const ChangePasswordPage = () => {
  const { changePassword } = useAuth()
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
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null)
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      })
      navigate(paths.profile, { replace: true, state: { passwordChanged: true } })
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  return (
    <div className="card bg-base-100 border border-base-300">
      <form className="card-body gap-3" onSubmit={onSubmit} noValidate>
        <h1 className="card-title text-xl">পাসওয়ার্ড পরিবর্তন</h1>
        <p className="text-sm text-base-content/70 -mt-1">
          সফল হলে পুরনো রিফ্রেশ টোকেন বাতিল হবে
        </p>

        <ApiErrorAlert error={apiError} />

        <label className="form-control w-full">
          <span className="label-text mb-1">বর্তমান পাসওয়ার্ড</span>
          <input
            type="password"
            autoComplete="current-password"
            className={`input input-bordered w-full ${errors.current_password ? 'input-error' : ''}`}
            {...register('current_password')}
          />
          {errors.current_password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.current_password.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">নতুন পাসওয়ার্ড</span>
          <input
            type="password"
            autoComplete="new-password"
            className={`input input-bordered w-full ${errors.new_password ? 'input-error' : ''}`}
            {...register('new_password')}
          />
          {errors.new_password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.new_password.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">নতুন পাসওয়ার্ড (আবার)</span>
          <input
            type="password"
            autoComplete="new-password"
            className={`input input-bordered w-full ${errors.confirm_password ? 'input-error' : ''}`}
            {...register('confirm_password')}
          />
          {errors.confirm_password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.confirm_password.message}
            </span>
          ) : null}
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'আপডেট'
            )}
          </button>
          <Link to={paths.profile} className="btn btn-ghost">
            বাতিল
          </Link>
        </div>
      </form>
    </div>
  )
}
