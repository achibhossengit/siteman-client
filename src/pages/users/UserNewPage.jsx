import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createUser } from '../../api/users.js'
import {
  passwordCreateSchema,
  toUserCreatePayload,
  userCreateSchema,
} from '../../api/types/user.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { toastSuccess } from '../../utils/feedback.js'
import { BD_PHONE_MESSAGE, isBdPhoneNumber } from '../../utils/phone.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

const emptyValues = {
  name: '',
  phone_number: '',
  password: '',
}

/** Only show hints while invalid — valid fields stay quiet like নাম. */
const phoneLiveHint = (raw) => {
  const value = String(raw ?? '').trim()
  if (!value) return null
  if (!/^\d*$/.test(value)) return 'শুধু সংখ্যা দিন'
  if (value.length < 11) return `১১ ডিজিট দিন (${value.length}/১১)`
  if (!isBdPhoneNumber(value)) return BD_PHONE_MESSAGE
  return null
}

const passwordLiveHint = (raw) => {
  const value = String(raw ?? '')
  if (!value) return null
  const parsed = passwordCreateSchema.safeParse(value)
  if (parsed.success) return null
  return parsed.error.issues?.[0]?.message || 'সঠিক পাসওয়ার্ড দিন'
}

export const UserNewPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [apiError, setApiError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const canAddUser = can(PERMS.addUser)

  useEffect(() => {
    setTitle?.('নতুন ইউজার')
    return () => setTitle?.('')
  }, [setTitle])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(userCreateSchema),
    defaultValues: emptyValues,
  })

  const watched = watch()
  const phoneHint = useMemo(
    () => phoneLiveHint(watched.phone_number),
    [watched.phone_number],
  )
  const passwordHint = useMemo(
    () => passwordLiveHint(watched.password),
    [watched.password],
  )
  const formReady = useMemo(
    () => userCreateSchema.safeParse(watched).success,
    [watched],
  )

  const mutation = useMutation({
    mutationFn: (values) => createUser(toUserCreatePayload(values)),
  })

  const busy = isSubmitting || mutation.isPending
  const saveDisabled = busy || !formReady

  const saveUser = async (values, { createAnother }) => {
    setApiError(null)
    try {
      await mutation.mutateAsync(values)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toastSuccess('ইউজার তৈরি হয়েছে')
      if (createAnother) {
        reset(emptyValues)
        setShowPassword(false)
      } else {
        navigate(paths.users, { replace: true })
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  }

  const onSubmit = handleSubmit((values) =>
    saveUser(values, { createAnother: false }),
  )

  const onSaveAndCreateAnother = handleSubmit((values) =>
    saveUser(values, { createAnother: true }),
  )

  if (!canAddUser) {
    return (
      <div className="text-sm text-error py-8 text-center">
        ইউজার যোগ করার অনুমতি নেই।
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      <p className="text-sm text-base-content/70 mb-3">
        প্রাথমিক পাসওয়ার্ড এখানে সেট করুন এবং ইউজারকে জানিয়ে দিন। পরে ইউজার
        নিজে পাসওয়ার্ড বদলাতে পারবে।
      </p>

      <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
        <label className="form-control w-full">
          <span className="label-text mb-1">নাম</span>
          <input
            type="text"
            className={`input input-bordered w-full ${errors.name ? 'input-error' : ''}`}
            maxLength={255}
            autoFocus
            placeholder="ইউজারের নাম দিন"
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
            className={`input input-bordered w-full ${
              errors.phone_number || phoneHint ? 'input-error' : ''
            }`}
            maxLength={11}
            placeholder="০১XXXXXXXXX"
            {...register('phone_number')}
          />
          {phoneHint ? (
            <span className="label-text-alt text-error mt-1">{phoneHint}</span>
          ) : errors.phone_number ? (
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
            className={`input input-bordered w-full ${
              errors.password || passwordHint ? 'input-error' : ''
            }`}
            placeholder="কমপক্ষে ৮ অক্ষর (শুধু সংখ্যা নয়)"
            {...register('password')}
          />
          {passwordHint ? (
            <span className="label-text-alt text-error mt-1">
              {passwordHint}
            </span>
          ) : errors.password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.password.message}
            </span>
          ) : null}
        </label>

        <div className="flex items-center justify-start text-sm">
          <button
            type="button"
            className="link link-hover text-base-content/70"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
          </button>
        </div>

        <div className="flex justify-between gap-2 mt-2">
          <button
            type="button"
            className="btn btn-outline btn-primary flex-1"
            disabled={saveDisabled}
            onClick={onSaveAndCreateAnother}
          >
            আরেকটি
          </button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={saveDisabled}
          >
            {busy ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'সংরক্ষণ'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
