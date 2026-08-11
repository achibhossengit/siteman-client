import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { createUser } from '../../api/users.js'
import {
  passwordCreateSchema,
  toUserCreatePayload,
  userCreateSchema,
} from '../../api/types/user.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { toastSuccess } from '../../utils/feedback.js'
import { BD_PHONE_MESSAGE, isBdPhoneNumber } from '../../utils/phone.js'

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

export const UserCreateModal = forwardRef(function UserCreateModal(_, ref) {
  const queryClient = useQueryClient()
  const dialogRef = useRef(null)
  const [apiError, setApiError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

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

  const resetModal = () => {
    setApiError(null)
    setShowPassword(false)
    reset(emptyValues)
  }

  const closeModal = () => {
    dialogRef.current?.close()
  }

  useImperativeHandle(ref, () => ({
    open: () => {
      resetModal()
      dialogRef.current?.showModal()
    },
  }))

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
        closeModal()
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

  return (
    <dialog ref={dialogRef} className="modal" onClose={resetModal}>
      <div className="modal-box max-w-sm max-h-[min(36rem,90vh)] flex flex-col">
        <form method="dialog">
          <button
            type="submit"
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            aria-label="বন্ধ"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </form>

        <h3 className="font-semibold text-base mb-2 pr-8 shrink-0">
          নতুন ইউজার
        </h3>

        <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

        <p className="text-sm text-base-content/70 mb-3 shrink-0">
          প্রাথমিক পাসওয়ার্ড এখানে সেট করুন এবং ইউজারকে জানিয়ে দিন। পরে ইউজার
          নিজে পাসওয়ার্ড বদলাতে পারবে।
        </p>

        <form
          className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
          onSubmit={onSubmit}
          noValidate
        >
          <label className="form-control w-full">
            <span className="label-text mb-1">নাম</span>
            <input
              type="text"
              className={`input input-bordered w-full ${errors.name ? 'input-error' : ''}`}
              maxLength={255}
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

          <div className="flex justify-between gap-2 mt-2 pb-1">
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
      <form method="dialog" className="modal-backdrop">
        <button type="submit">বন্ধ</button>
      </form>
    </dialog>
  )
})
