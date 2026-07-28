import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Mail, Pencil, Phone, Trash2, User, X } from 'lucide-react'
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
    watch,
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
  const nameValue = watch('name')
  const phoneValue = watch('phone_number')
  const emailValue = watch('email')
  const isActiveValue = watch('is_active')

  useEffect(() => {
    setTitle?.(user?.name || 'ইউজার বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, user?.name])

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
  const fieldClass = (hasError) =>
    [
      'input input-sm input-bordered w-full',
      hasError ? 'input-error' : '',
    ].join(' ')

  return (
    <div className="max-w-lg mx-auto space-y-3">
      <ApiErrorAlert error={apiError} />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!confirmReady) return
          return onConfirm(e)
        }}
        noValidate
      >
        <div
          className={[
            'rounded-2xl bg-base-100 border border-base-300 overflow-hidden',
            'border-l-4',
            isActiveValue ? 'border-l-success shadow-[inset_4px_0_12px_-8px_var(--color-success)]' : 'border-l-base-content/25',
          ].join(' ')}
        >
          {/* Header */}
          <div className="flex items-start gap-3 p-4">
            <div className="size-12 sm:size-14 shrink-0 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center">
              <User
                className="size-6 text-base-content/40"
                strokeWidth={1.5}
              />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 min-w-0">
                {editing ? (
                  <input
                    type="text"
                    className={[
                      'input input-sm input-ghost h-8 px-1 text-base font-semibold w-full max-w-48',
                      errors.name ? 'input-error' : '',
                    ].join(' ')}
                    maxLength={255}
                    {...register('name')}
                  />
                ) : (
                  <h2 className="text-base sm:text-lg font-semibold truncate leading-tight">
                    {nameValue || user.name}
                  </h2>
                )}
                {user.is_companyadmin ? (
                  <span className="badge badge-sm shrink-0 border-0 bg-secondary text-secondary-content">
                    অ্যাডমিন
                  </span>
                ) : null}
              </div>
              {errors.name ? (
                <p className="text-error text-xs mt-1">{errors.name.message}</p>
              ) : null}
              <p className="text-xs text-base-content/55 mt-1 tabular-nums">
                তৈরি {formatMetaDate(user.created_at)}
                <span className="mx-1.5 opacity-60">·</span>
                হালনাগাদ {formatMetaDate(user.updated_at)}
              </p>
            </div>

            <input
              type="checkbox"
              className="toggle toggle-sm toggle-success shrink-0 mt-1"
              disabled={disabled}
              {...register('is_active')}
            />
          </div>

          {/* Contact */}
          <div className="border-t border-base-300 px-4 py-3 space-y-2.5">
            {editing ? (
              <>
                <label className="form-control w-full">
                  <span className="label-text text-xs mb-1 flex items-center gap-1.5">
                    <Phone className="size-3.5 opacity-60" strokeWidth={1.75} />
                    ফোন নম্বর
                  </span>
                  <input
                    type="tel"
                    className={fieldClass(errors.phone_number)}
                    maxLength={14}
                    {...register('phone_number')}
                  />
                  {errors.phone_number ? (
                    <span className="label-text-alt text-error mt-1">
                      {errors.phone_number.message}
                    </span>
                  ) : null}
                </label>
                <label className="form-control w-full">
                  <span className="label-text text-xs mb-1 flex items-center gap-1.5">
                    <Mail className="size-3.5 opacity-60" strokeWidth={1.75} />
                    ইমেইল
                  </span>
                  <input
                    type="email"
                    className={fieldClass(errors.email)}
                    maxLength={254}
                    {...register('email')}
                  />
                  {errors.email ? (
                    <span className="label-text-alt text-error mt-1">
                      {errors.email.message}
                    </span>
                  ) : null}
                </label>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5 text-sm text-base-content/70">
                  <Phone
                    className="size-4 shrink-0 opacity-55"
                    strokeWidth={1.75}
                  />
                  <span className="truncate tabular-nums">
                    {phoneValue || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-base-content/70">
                  <Mail
                    className="size-4 shrink-0 opacity-55"
                    strokeWidth={1.75}
                  />
                  <span className="truncate">{emailValue || '—'}</span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          {(canDeleteUser || canChangeUser) && (
            <div className="border-t border-base-300 px-4 py-3 flex justify-end gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={cancelEdit}
                    disabled={busy}
                  >
                    <X className="size-4" strokeWidth={1.75} />
                    বাতিল করুন
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!confirmReady || busy}
                    onClick={(e) => {
                      if (!confirmReady) return
                      return onConfirm(e)
                    }}
                  >
                    {busy ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <Check className="size-4" strokeWidth={2} />
                    )}
                    নিশ্চিত করুন
                  </button>
                </>
              ) : (
                <>
                  {canDeleteUser ? (
                    <button
                      type="button"
                      className="btn btn-square btn-sm btn-ghost border border-error/40"
                      onClick={onDelete}
                      disabled={deleteMutation.isPending}
                      aria-label="ডিলিট করুন"
                    >
                      {deleteMutation.isPending ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Trash2
                          className="size-4 text-error"
                          strokeWidth={1.75}
                        />
                      )}
                    </button>
                  ) : null}
                  {canChangeUser ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm gap-1.5"
                      onClick={startEdit}
                    >
                      <Pencil className="size-4" strokeWidth={1.75} />
                      আপডেট করুন
                    </button>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
