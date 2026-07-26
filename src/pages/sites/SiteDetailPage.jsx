import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteSite, fetchSiteDetail, updateSite } from '../../api/sites.js'
import {
  normalizeSite,
  siteFormSchema,
  siteStatusClass,
  siteStatusLabel,
  toSitePayload,
} from '../../api/types/site.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

const toFormValues = (site) => ({
  name: site?.name ?? '',
  is_active: site?.isActive ?? true,
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

export const SiteDetailPage = () => {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const queryClient = useQueryClient()
  const { bootstrapProfile } = useAuth()
  const { can } = usePermissions()
  const [editing, setEditing] = useState(false)
  const [confirmReady, setConfirmReady] = useState(false)
  const [apiError, setApiError] = useState(null)

  const canViewSite = can(PERMS.viewSite)
  const canChangeSite = can(PERMS.changeSite)
  const canDeleteSite = can(PERMS.deleteSite)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(siteFormSchema),
    defaultValues: toFormValues(null),
  })

  const detailQuery = useQuery({
    queryKey: ['sites', siteId],
    queryFn: async () => {
      const { data } = await fetchSiteDetail(siteId)
      return normalizeSite(data)
    },
    enabled: Boolean(canViewSite && siteId),
  })

  const site = detailQuery.data

  useEffect(() => {
    setTitle?.(site?.name || 'সাইট বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, site?.name])

  useEffect(() => {
    if (site) reset(toFormValues(site))
  }, [site, reset])

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
    mutationFn: (values) => updateSite(siteId, toSitePayload(values)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSite(siteId),
  })

  const startEdit = () => {
    if (site?.isClosed) return
    // #region agent log
    fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf2ae1'},body:JSON.stringify({sessionId:'bf2ae1',runId:'post-fix2',hypothesisId:'A',location:'SiteDetailPage.jsx:startEdit',message:'startEdit clicked',data:{page:'site',editingBefore:editing,confirmReady,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setApiError(null)
    setConfirmReady(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    setApiError(null)
    reset(toFormValues(site))
    setEditing(false)
  }

  const onDelete = async () => {
    const ok = window.confirm('এই সাইট মুছে ফেলতে চান?')
    if (!ok) return
    setApiError(null)
    try {
      await deleteMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
      try {
        await bootstrapProfile()
      } catch {
        // ignore
      }
      navigate(paths.sites, { replace: true })
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }

  const onConfirm = handleSubmit(async (values) => {
    // #region agent log
    fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf2ae1'},body:JSON.stringify({sessionId:'bf2ae1',runId:'post-fix2',hypothesisId:'A',location:'SiteDetailPage.jsx:onConfirm',message:'onConfirm fired',data:{page:'site',editing,confirmReady,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setApiError(null)
    try {
      const { data } = await mutation.mutateAsync(values)
      const normalized = normalizeSite(data)
      reset(toFormValues(normalized))
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
      try {
        await bootstrapProfile()
      } catch {
        // ignore
      }
      setEditing(false)
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  if (!canViewSite) {
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

  if (!site) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        সাইট পাওয়া যায়নি।
      </div>
    )
  }

  const disabled = !editing || site.isClosed
  const fieldClass = (hasError) =>
    [
      'input input-bordered w-full',
      hasError ? 'input-error' : '',
      disabled ? 'bg-base-200' : '',
    ].join(' ')

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <ApiErrorAlert error={apiError} className="mb-1" />

      {site.isClosed ? (
        <div className="alert alert-warning text-sm py-2">
          এই সাইট বন্ধ — পরিবর্তন করা যাবে না।
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <span className={`badge ${siteStatusClass(site)}`}>
          {siteStatusLabel(site)}
        </span>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          // #region agent log
          const submitter = e.nativeEvent?.submitter
          fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf2ae1'},body:JSON.stringify({sessionId:'bf2ae1',runId:'post-fix2',hypothesisId:'B',location:'SiteDetailPage.jsx:form.onSubmit',message:'form submit event',data:{page:'site',editing,confirmReady,submitterType:submitter?.type??null,submitterText:submitter?.textContent?.trim?.()?.slice(0,40)??null,blocked:!confirmReady,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (!confirmReady) return
          return onConfirm(e)
        }}
        noValidate
      >
        <label className="form-control w-full">
          <span className="label-text mb-1">সাইটের নাম</span>
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
            <span className="tabular-nums">{formatDateTime(site.createdAt)}</span>
          </div>
          <div>
            <span className="text-base-content/60">হালনাগাদ:</span>{' '}
            <span className="tabular-nums">{formatDateTime(site.updatedAt)}</span>
          </div>
          {site.closedAt ? (
            <div className="sm:col-span-2">
              <span className="text-base-content/60">বন্ধের সময়:</span>{' '}
              <span className="tabular-nums">
                {formatDateTime(site.closedAt)}
              </span>
            </div>
          ) : null}
        </div>

        {!site.isClosed || canDeleteSite ? (
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
                  fetch('http://127.0.0.1:7900/ingest/5c2ebad5-d1cd-4cd7-908c-619d23ef27d4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bf2ae1'},body:JSON.stringify({sessionId:'bf2ae1',runId:'post-fix2',hypothesisId:'A',location:'SiteDetailPage.jsx:confirmBtn.onClick',message:'confirm button click',data:{page:'site',confirmReady,ts:Date.now()},timestamp:Date.now()})}).catch(()=>{});
                  // #endregion
                  if (!confirmReady) return
                  return onConfirm(e)
                }}
              >
                {isSubmitting || mutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "নিশ্চিত"
                )}
              </button>
            </>
          ) : (
            <>
              {canDeleteSite ? (
                <button
                  type="button"
                  className="btn btn-error btn-outline"
                  onClick={onDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "মুছুন"
                  )}
                </button>
              ) : null}
              {canChangeSite ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={startEdit}
                  disabled={site.isClosed}
                >
                  আপডেট
                </button>
              ) : null}
            </>
          )}
        </div>
        ) : null}
      </form>
    </div>
  )
}
