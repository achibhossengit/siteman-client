import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { deleteUser, fetchUserDetail, updateUser } from '../../api/users.js'
import {
  toUserUpdatePayload,
  userUpdateSchema,
} from '../../api/types/user.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

const toFormValues = (user) => ({
  name: user?.name ?? '',
  phone_number: user?.phone_number ?? '',
  email: user?.email ?? '',
  is_active: user?.is_active ?? true,
})

const formatMetaDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'আজ'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
  }).format(d)
}

export const UserDetailPage = () => {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [editing, setEditing] = useState(false)
  const [confirmReady, setConfirmReady] = useState(false)
  const [apiError, setApiError] = useState(null)

  const canViewUser = can(PERMS.viewUser)
  const canChangeUser = can(PERMS.changeUser)
  const canDeleteUser = can(PERMS.deleteUser)

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
      return data
    },
    enabled: Boolean(canViewUser && userId),
  })

  const user = detailQuery.data

  useEffect(() => {
    setTitle?.('ইউজার বিবরণ')
    return () => setTitle?.('')
  }, [setTitle])

  useEffect(() => {
    if (user) reset(toFormValues(user))
  }, [user, reset])

  // Prevent ghost-submit: Update and Confirm share the same spot.
  useEffect(() => {
    if (!editing) {
      setConfirmReady(false)
      return
    }
    let cancelled = false
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setConfirmReady(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [editing])

  const mutation = useMutation({
    mutationFn: (values) => updateUser(userId, toUserUpdatePayload(values)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(userId),
  })

  const startEdit = () => {
    setApiError(null)
    setConfirmReady(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    setApiError(null)
    reset(toFormValues(user))
    setEditing(false)
  }

  const onDelete = async () => {
    const ok = window.confirm('এই ইউজার মুছে ফেলতে চান?')
    if (!ok) return
    setApiError(null)
    try {
      await deleteMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      navigate(paths.users, { replace: true })
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await mutation.mutateAsync(values)
      reset(toFormValues(data))
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditing(false)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  if (!canViewUser) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

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
  const busy = isSubmitting || mutation.isPending
  const showActions = canChangeUser || canDeleteUser
  const fieldClass = (hasError) =>
    [
      'input input-bordered w-full',
      hasError ? 'input-error' : '',
      disabled ? 'bg-base-100' : '',
    ].join(' ')

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!confirmReady) return
          return onConfirm(e)
        }}
        noValidate
      >
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

        <label className="label cursor-pointer justify-start gap-3 py-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            disabled={disabled}
            {...register('is_active')}
          />
          <span className="label-text">সক্রিয়</span>
        </label>

        {user.is_companyadmin ? (
          <div className="flex items-center gap-2">
            <span className="label-text">ভূমিকা</span>
            <span className="badge badge-secondary badge-sm">অ্যাডমিন</span>
          </div>
        ) : null}

        <p className="text-xs text-base-content/55 tabular-nums">
          তৈরি {formatMetaDate(user.created_at)}
          <span className="mx-1.5 opacity-60">·</span>
          হালনাগাদ {formatMetaDate(user.updated_at)}
        </p>

        {showActions ? (
          editing ? (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={cancelEdit}
                disabled={busy}
              >
                <X className="size-4" strokeWidth={1.75} />
                বাতিল করুন
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={!confirmReady || busy}
                onClick={(e) => {
                  if (!confirmReady) return
                  return onConfirm(e)
                }}
              >
                {busy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Check className="size-4" strokeWidth={2} />
                )}
                নিশ্চিত করুন
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-2">
              {canDeleteUser ? (
                <button
                  type="button"
                  className="btn btn-outline btn-error flex-1"
                  onClick={onDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  )}
                  ডিলিট
                </button>
              ) : null}
              {canChangeUser ? (
                <button
                  type="button"
                  className="btn btn-outline btn-primary flex-1"
                  onClick={startEdit}
                >
                  <Pencil className="size-4" strokeWidth={1.75} />
                  আপডেট
                </button>
              ) : null}
            </div>
          )
        ) : null}
      </form>
    </div>
  )
}
