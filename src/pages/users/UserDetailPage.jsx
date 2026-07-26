import { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchUserDetail, updateUser } from '../../api/users.js'
import {
  normalizeUser,
  toUserUpdatePayload,
  userStatusClass,
  userStatusLabel,
  userUpdateSchema,
} from '../../api/types/user.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'

const toFormValues = (user) => ({
  name: user?.name ?? '',
  phone_number: user?.phoneNumber ?? '',
  email: user?.email ?? '',
  is_active: user?.isActive ?? true,
})

const formatDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

export const UserDetailPage = () => {
  const { userId } = useParams()
  const { setTitle } = useOutletContext()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [apiError, setApiError] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: toFormValues(null),
  })

  const detailQuery = useQuery({
    queryKey: ['users', userId],
    queryFn: async () => {
      const { data } = await fetchUserDetail(userId)
      return normalizeUser(data)
    },
    enabled: Boolean(userId),
  })

  const user = detailQuery.data

  useEffect(() => {
    setTitle?.(user?.name || 'ইউজার বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, user?.name])

  useEffect(() => {
    if (user) reset(toFormValues(user))
  }, [user, reset])

  const mutation = useMutation({
    mutationFn: (values) => updateUser(userId, toUserUpdatePayload(values)),
  })

  const startEdit = () => {
    setApiError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setApiError(null)
    reset(toFormValues(user))
    setEditing(false)
  }

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await mutation.mutateAsync(values)
      const normalized = normalizeUser(data)
      reset(toFormValues(normalized))
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditing(false)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  if (detailQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (detailQuery.isError) {
    return <ApiErrorAlert error={parseApiError(detailQuery.error)} />
  }

  if (!user) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        ইউজার পাওয়া যায়নি।
      </div>
    )
  }

  const disabled = !editing
  const fieldClass = (hasError) =>
    [
      'input input-bordered w-full',
      hasError ? 'input-error' : '',
      disabled ? 'bg-base-200' : '',
    ].join(' ')

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <ApiErrorAlert error={apiError} className="mb-1" />

      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${userStatusClass(user)}`}>
          {userStatusLabel(user)}
        </span>
        {user.isCompanyAdmin ? (
          <span className="badge badge-outline badge-sm">কোম্পানি অ্যাডমিন</span>
        ) : null}
      </div>

      <form className="flex flex-col gap-3" onSubmit={onConfirm} noValidate>
        <label className="form-control w-full">
          <span className="label-text mb-1">নাম</span>
          <input
            type="text"
            className={fieldClass(errors.name)}
            maxLength={255}
            disabled={disabled}
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
            className={fieldClass(errors.phone_number)}
            maxLength={14}
            disabled={disabled}
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
            className={fieldClass(errors.email)}
            maxLength={254}
            disabled={disabled}
            {...register('email')}
          />
          {errors.email ? (
            <span className="label-text-alt text-error mt-1">
              {errors.email.message}
            </span>
          ) : null}
        </label>

        <label
          className={[
            'label justify-start gap-3 py-2',
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <input
            type="checkbox"
            className="toggle toggle-primary"
            disabled={disabled}
            {...register('is_active')}
          />
          <span className="label-text">সক্রিয়</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-1">
          <div>
            <span className="text-base-content/60">তৈরি:</span>{' '}
            <span className="tabular-nums">{formatDateTime(user.createdAt)}</span>
          </div>
          <div>
            <span className="text-base-content/60">হালনাগাদ:</span>{' '}
            <span className="tabular-nums">{formatDateTime(user.updatedAt)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelEdit}
                disabled={isSubmitting || mutation.isPending}
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || mutation.isPending}
              >
                {isSubmitting || mutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'নিশ্চিত'
                )}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={startEdit}>
              আপডেট
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
