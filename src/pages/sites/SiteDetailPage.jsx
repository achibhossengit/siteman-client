import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { deleteSite, fetchSiteDetail, updateSite } from '../../api/sites.js'
import { siteFormSchema, siteStatusLabel, toSitePayload } from '../../api/types/site.js'
import {
  parseApiError,
  applyFieldErrors,
  siteDeleteUiMessage,
} from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { DetailMenuButton } from '../../layouts/DetailLayout.jsx'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { toastSuccess } from '../../utils/feedback.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'
import { SHOW_BILLING } from '../../config/features.js'
import { SiteBillingPanel } from './SiteBillingPanel.jsx'
import { SitePrivateCashPanel } from './SitePrivateCashPanel.jsx'

const SITE_EDIT_MODAL_ID = 'site-edit-modal'
const SITE_DELETE_MODAL_ID = 'site-delete-modal'

const deleteSchema = z.object({
  password: z.string().min(1, 'পাসওয়ার্ড দিন'),
})

const toSiteFormValues = (site) => ({
  name: site?.name ?? '',
  is_active: site?.is_active ?? true,
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

export const SiteDetailPage = () => {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const queryClient = useQueryClient()
  const { bootstrapProfile } = useAuth()
  const { can } = usePermissions()
  const siteEditDialogRef = useRef(null)
  const siteDeleteDialogRef = useRef(null)

  const [siteApiError, setSiteApiError] = useState(null)
  const [deleteApiError, setDeleteApiError] = useState(null)
  const [detailFetchEnabled, setDetailFetchEnabled] = useState(true)
  const [openSection, setOpenSection] = useState(
    SHOW_BILLING ? 'billing' : 'private',
  )

  const canViewSite = can(PERMS.viewSite)
  const canChangeSite = can(PERMS.changeSite)
  const canDeleteSite = can(PERMS.deleteSite)

  const {
    register: registerSite,
    handleSubmit: handleSubmitSite,
    reset: resetSite,
    setError: setSiteError,
    formState: { errors: siteErrors, isSubmitting: siteIsSubmitting, isDirty: siteIsDirty },
  } = useForm({
    resolver: zodResolver(siteFormSchema),
    defaultValues: toSiteFormValues(null),
  })

  const {
    register: registerDelete,
    handleSubmit: handleSubmitDelete,
    reset: resetDelete,
    setError: setDeleteError,
    watch: watchDelete,
    formState: { errors: deleteErrors, isSubmitting: deleteSubmitting },
  } = useForm({
    resolver: zodResolver(deleteSchema),
    defaultValues: { password: '' },
  })

  const detailQuery = useQuery({
    queryKey: ['sites', siteId],
    queryFn: async () => {
      const { data } = await fetchSiteDetail(siteId)
      return data
    },
    enabled: Boolean(canViewSite && siteId && detailFetchEnabled),
    retry: (failureCount, error) =>
      error?.response?.status !== 404 && failureCount < 2,
  })

  const site = detailQuery.data
  const deletePassword = watchDelete('password')
  const deleteReady = (deletePassword ?? '').length > 0

  const updateSiteMutation = useMutation({
    mutationFn: (values) => updateSite(siteId, toSitePayload(values)),
  })

  const deleteSiteMutation = useMutation({
    mutationFn: (password) => deleteSite(siteId, { password }),
  })

  useEffect(() => {
    if (site) resetSite(toSiteFormValues(site))
  }, [site, resetSite])

  const openEditModal = () => {
    if (!site || site.is_closed) return
    setSiteApiError(null)
    resetSite(toSiteFormValues(site))
    siteEditDialogRef.current?.showModal()
  }

  const closeEditModal = () => {
    siteEditDialogRef.current?.close()
  }

  const onEditModalClose = () => {
    setSiteApiError(null)
    resetSite(toSiteFormValues(site))
  }

  const onConfirmSiteEdit = handleSubmitSite(async (values) => {
    setSiteApiError(null)
    try {
      const { data } = await updateSiteMutation.mutateAsync(values)
      resetSite(toSiteFormValues(data))
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
      try {
        await bootstrapProfile()
      } catch {
        // ignore
      }
      closeEditModal()
      toastSuccess('সাইট আপডেট হয়েছে')
    } catch (err) {
      const parsed = parseApiError(err)
      setSiteApiError(parsed)
      applyFieldErrors(parsed, setSiteError)
    }
  })

  const openDeleteModal = () => {
    if (!canDeleteSite || !site) return
    setDeleteApiError(null)
    resetDelete({ password: '' })
    siteDeleteDialogRef.current?.showModal()
  }

  const closeDeleteModal = () => {
    siteDeleteDialogRef.current?.close()
  }

  const onDeleteModalClose = () => {
    setDeleteApiError(null)
    resetDelete({ password: '' })
  }

  const onConfirmSiteDelete = handleSubmitDelete(async (values) => {
    setDeleteApiError(null)
    try {
      await deleteSiteMutation.mutateAsync(values.password)
      await queryClient.cancelQueries({ queryKey: ['sites', siteId] })
      flushSync(() => setDetailFetchEnabled(false))
      queryClient.removeQueries({ queryKey: ['sites', siteId] })
      closeDeleteModal()
      toastSuccess('সাইট ডিলিট হয়েছে')
      navigate(paths.sites, { replace: true })
      try {
        await bootstrapProfile()
      } catch {
        // ignore
      }
      void queryClient.invalidateQueries({ queryKey: ['sites'] })
    } catch (err) {
      const parsed = parseApiError(err)
      const fieldKeys = Object.keys(parsed.fieldErrors ?? {})
      const onlyPasswordError =
        fieldKeys.length === 1 && fieldKeys[0] === 'password'
      const onlyAuthFailure =
        fieldKeys.length === 0 &&
        (parsed.status === 401 ||
          (parsed.errors?.length === 1 &&
            (parsed.hasCode?.('authentication_failed') ||
              parsed.hasCode?.('incorrect_password'))))

      if (onlyPasswordError || onlyAuthFailure) {
        setDeleteError('password', {
          type: 'server',
          message: onlyPasswordError
            ? parsed.fieldErrors.password[0]
            : 'পাসওয়ার্ড সঠিক নয়।',
        })
        return
      }

      const message = siteDeleteUiMessage(parsed)
      setDeleteApiError({
        ...parsed,
        message,
        errors: [
          {
            code: parsed.errors?.[0]?.code || 'error',
            detail: message,
            attr: null,
          },
        ],
      })
      applyFieldErrors(parsed, setDeleteError)
    }
  })

  const openEditModalRef = useRef(openEditModal)
  openEditModalRef.current = openEditModal
  const openDeleteModalRef = useRef(openDeleteModal)
  openDeleteModalRef.current = openDeleteModal

  useEffect(() => {
    setTitle?.('সাইট বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, siteId])

  const canUpdateFromMenu = canChangeSite && site && !site.is_closed
  const canDeleteThisSite = Boolean(canDeleteSite && site)

  useEffect(() => {
    if (!siteId || (!canUpdateFromMenu && !canDeleteThisSite)) {
      setHeaderMenu?.(null)
      return () => setHeaderMenu?.(null)
    }
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-52 p-1 shadow-md border border-base-300"
        >
          {canUpdateFromMenu ? (
            <li>
              <button
                type="button"
                onClick={() => openEditModalRef.current()}
              >
                আপডেট
              </button>
            </li>
          ) : null}
          {canDeleteThisSite ? (
            <li>
              <button
                type="button"
                className="text-error"
                onClick={() => openDeleteModalRef.current()}
              >
                ডিলিট
              </button>
            </li>
          ) : null}
        </ul>
      </DetailMenuButton>,
    )
    return () => setHeaderMenu?.(null)
  }, [siteId, setHeaderMenu, canUpdateFromMenu, canDeleteThisSite])

  if (!canViewSite) {
    return (
      <div className="text-sm text-error py-8 text-center px-3">
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
      <div className="text-sm text-base-content/70 py-8 text-center px-3">
        সাইট পাওয়া যায়নি।
      </div>
    )
  }

  const siteBusy = siteIsSubmitting || updateSiteMutation.isPending
  const deleteBusy = deleteSubmitting || deleteSiteMutation.isPending
  const siteFieldClass = (hasError) =>
    [
      'input input-bordered w-full',
      hasError ? 'input-error' : '',
      site.is_closed ? 'bg-base-100' : '',
    ].join(' ')

  const siteInactive = site.is_active === false
  const billingOpen = openSection === 'billing'
  const privateOpen = openSection === 'private'

  return (
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto space-y-4 relative px-3 pt-3 pb-20">
      <ApiErrorAlert error={siteApiError} />

      {site.is_closed ? (
        <div className="alert alert-warning text-sm py-2">
          এই সাইট কমপ্লিট — পরিবর্তন করা যাবে না।
        </div>
      ) : null}

      <section className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">নাম</span>
          <span className="font-medium text-right">{site.name || '—'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">স্ট্যাটাস</span>
          <span className="font-medium text-right">
            {siteStatusLabel(site)}
          </span>
        </div>
        <p className="text-xs text-base-content/55 tabular-nums pt-1">
          {site.closed_at ? (
            <>
              <span className="mx-1.5 opacity-60">·</span>
              কমপ্লিট {formatMetaDate(site.closed_at)}
            </>
          ) : null}
        </p>
      </section>

      <div className="space-y-2">
        {SHOW_BILLING ? (
          <div
            className={[
              'collapse collapse-arrow border border-base-300 bg-base-100',
              billingOpen ? 'collapse-open' : 'collapse-close',
            ].join(' ')}
          >
            <div
              role="button"
              tabIndex={0}
              className="collapse-title min-h-0 py-3 px-3 text-sm font-medium"
              onClick={() => setOpenSection('billing')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpenSection('billing')
                }
              }}
            >
              বিলিং ক্যাটাগরি
            </div>
            <div className="collapse-content px-3">
              {billingOpen ? (
                <SiteBillingPanel
                  siteId={siteId}
                  showFab={billingOpen}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          className={[
            'collapse collapse-arrow border border-base-300 bg-base-100',
            privateOpen ? 'collapse-open' : 'collapse-close',
          ].join(' ')}
        >
          <div
            role="button"
            tabIndex={0}
            className="collapse-title min-h-0 py-3 px-3 text-sm font-medium"
            onClick={() => setOpenSection('private')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setOpenSection('private')
              }
            }}
          >
            প্রাইভেট হিসাব
          </div>
          <div className="collapse-content px-3">
            {privateOpen ? (
              <SitePrivateCashPanel
                siteId={siteId}
                siteInactive={siteInactive}
                showFab={privateOpen}
              />
            ) : null}
          </div>
        </div>
      </div>

      <dialog
        ref={siteEditDialogRef}
        id={SITE_EDIT_MODAL_ID}
        className="modal"
        onClose={onEditModalClose}
      >
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8 shrink-0">সাইট আপডেট</h3>

          <ApiErrorAlert error={siteApiError} className="mb-3 shrink-0" />

          <form
            className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault()
              return onConfirmSiteEdit(e)
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">নাম</span>
              <input
                type="text"
                className={siteFieldClass(siteErrors.name)}
                maxLength={255}
                disabled={site.is_closed}
                {...registerSite('name')}
              />
              {siteErrors.name ? (
                <span className="label-text-alt text-error mt-1">
                  {siteErrors.name.message}
                </span>
              ) : null}
            </label>

            <label
              className={[
                'label justify-start gap-3 py-2',
                site.is_closed ? 'cursor-default' : 'cursor-pointer',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="toggle toggle-primary"
                disabled={site.is_closed}
                {...registerSite('is_active')}
              />
              <span className="label-text">চালু</span>
            </label>

            <div className="mt-2">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!siteIsDirty || siteBusy || site.is_closed}
              >
                {siteBusy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                নিশ্চিত
              </button>
            </div>
          </form>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>

      <dialog
        ref={siteDeleteDialogRef}
        id={SITE_DELETE_MODAL_ID}
        className="modal"
        onClose={onDeleteModalClose}
      >
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
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
            সাইট ডিলিট করবেন?
          </h3>
          <p className="text-sm text-base-content/70 mb-3 shrink-0">
          ডিলিট করা সাইট পুনরায় ফিরিয়ে আনা যাবে না। নিশ্চিত করতে আপনার পাসওয়ার্ড দিন।
          </p>

          <ApiErrorAlert error={deleteApiError} />

          <form
            className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault()
              return onConfirmSiteDelete(e)
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">আপনার পাসওয়ার্ড</span>
              <input
                type="password"
                autoComplete="current-password"
                maxLength={20}
                className={`input input-bordered w-full ${
                  deleteErrors.password ? 'input-error' : ''
                }`}
                placeholder="পাসওয়ার্ড দিন"
                {...registerDelete('password')}
              />
              {deleteErrors.password ? (
                <span className="label-text-alt text-error mt-1">
                  {deleteErrors.password.message}
                </span>
              ) : null}
            </label>

            <div className="mt-2 shrink-0">
              <button
                type="submit"
                className="btn btn-error w-full"
                disabled={!deleteReady || deleteBusy}
              >
                {deleteBusy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                ডিলিট করুন
              </button>
            </div>
          </form>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>
    </div>
  )
}
