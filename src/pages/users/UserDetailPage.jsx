import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteUser, fetchUserDetail, updateUser } from '../../api/users.js'
import {
  normalizeUser,
  toUserUpdatePayload,
  userStatusClass,
  userStatusLabel,
  userUpdateSchema,
} from '../../api/types/user.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

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
      return normalizeUser(data)
    },
    enabled: Boolean(canViewUser && userId),
  })

  const user = detailQuery.data

  useEffect(() => {
    setTitle?.(user?.name || 'ইউজার বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, user?.name])

  useEffect(() => {
    if (user) reset(toFormValues(user))
  }, [user, reset])

  // Prevent ghost-submit: Update and Confirm share the same spot.
  // Arm Confirm only after the Update click event has fully settled.
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
    // #region agent log
    fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf2ae1'},body:JSON.stringify({sessionId:'bf2ae1',runId:'post-fix2',hypothesisId:'A',location:'UserDetailPage.jsx:startEdit',message:'startEdit clicked',data:{page:'user',editingBefore:editing,confirmReady,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf2ae1'},body:JSON.stringify({sessionId:'bf2ae1',runId:'post-fix2',hypothesisId:'A',location:'UserDetailPage.jsx:onConfirm',message:'onConfirm fired',data:{page:'user',editing,confirmReady,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          // #region agent log
          const submitter = e.nativeEvent?.submitter
          fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf2ae1'},body:JSON.stringify({sessionId:'bf2ae1',runId:'post-fix2',hypothesisId:'B',location:'UserDetailPage.jsx:form.onSubmit',message:'form submit event',data:{page:'user',editing,confirmReady,submitterType:submitter?.type??null,submitterText:submitter?.textContent?.trim?.()?.slice(0,40)??null,blocked:!confirmReady,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
                type="button"
                className="btn btn-primary"
                disabled={!confirmReady || isSubmitting || mutation.isPending}
                onClick={(e) => {
                  // #region agent log
                  fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf2ae1'},body:JSON.stringify({sessionId:'bf2ae1',runId:'post-fix2',hypothesisId:'A',location:'UserDetailPage.jsx:confirmBtn.onClick',message:'confirm button click',data:{page:'user',confirmReady,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{});
                  // #endregion
                  if (!confirmReady) return
                  return onConfirm(e)
                }}
              >
                {isSubmitting || mutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'নিশ্চিত'
                )}
              </button>
            </>
          ) : (
            <>
              {canDeleteUser ? (
                <button
                  type="button"
                  className="btn btn-error btn-outline"
                  onClick={onDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    'মুছুন'
                  )}
                </button>
              ) : null}
              {canChangeUser ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={startEdit}
                >
                  আপডেট
                </button>
              ) : null}
            </>
          )}
        </div>
      </form>
    </div>
  )
}
