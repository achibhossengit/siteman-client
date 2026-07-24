import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogOut, KeyRound } from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { updateProfile } from '../../api/profile.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { paths } from '../../router/paths.js'

const schema = z.object({
  name: z.string().min(2, 'নাম দিন'),
  email: z
    .string()
    .email('সঠিক ইমেইল দিন')
    .optional()
    .or(z.literal('')),
  phone_number: z.string().min(8, 'ফোন নম্বর দিন'),
})

export const ProfilePage = () => {
  const { profile, setProfile, logout, bootstrapProfile } = useAuth()
  const navigate = useNavigate()
  const [apiError, setApiError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: {
      name: profile?.name ?? '',
      email: profile?.email ?? '',
      phone_number: profile?.phone_number ?? '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null)
    setSaved(false)
    try {
      const { data } = await updateProfile({
        name: values.name,
        email: values.email || null,
        phone_number: values.phone_number,
      })
      setProfile(data)
      setSaved(true)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
      try {
        await bootstrapProfile()
      } catch {
        // ignore
      }
    }
  })

  const onLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate(paths.login, { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="card-title text-xl">প্রোফাইল</h1>
              <p className="text-sm text-base-content/70">
                {profile?.company?.name || 'কোম্পানি'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <LogOut className="size-4" />
              )}
              লগআউট
            </button>
          </div>

          {profile?.groups?.length ? (
            <div className="flex flex-wrap gap-1">
              {profile.groups.map((g) => (
                <span key={g.id} className="badge badge-outline">
                  {g.name}
                </span>
              ))}
              {profile.is_companyadmin ? (
                <span className="badge badge-primary badge-outline">
                  Company Admin scope
                </span>
              ) : null}
            </div>
          ) : null}

          <ApiErrorAlert error={apiError} />
          {saved ? (
            <div className="alert alert-success text-sm py-2">
              প্রোফাইল আপডেট হয়েছে
            </div>
          ) : null}

          <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
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
              <span className="label-text mb-1">ফোন</span>
              <input
                type="tel"
                className={`input input-bordered w-full ${errors.phone_number ? 'input-error' : ''}`}
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
                {...register('email')}
              />
              {errors.email ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.email.message}
                </span>
              ) : null}
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                'সেভ'
              )}
            </button>
          </form>

          <Link
            to={paths.changePassword}
            className="btn btn-outline btn-sm gap-2 self-start"
          >
            <KeyRound className="size-4" />
            পাসওয়ার্ড বদলান
          </Link>
        </div>
      </div>
    </div>
  )
}
