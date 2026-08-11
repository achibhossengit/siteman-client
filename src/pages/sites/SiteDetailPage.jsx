import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { deleteSite, fetchSiteDetail, updateSite } from '../../api/sites.js'
import { siteFormSchema, siteStatusLabel, toSitePayload } from '../../api/types/site.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { DetailMenuButton } from '../../layouts/DetailLayout.jsx'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { confirmAction, toastSuccess } from '../../utils/feedback.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'
import { SiteBillingPanel } from './SiteBillingPanel.jsx'
import { SitePrivateCashPanel } from './SitePrivateCashPanel.jsx'

const SITE_EDIT_MODAL_ID = 'site-edit-modal'

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

  const [siteApiError, setSiteApiError] = useState(null)
  const [openSection, setOpenSection] = useState('billing')

  const canViewSite = can(PERMS.viewSite)
  const canChangeSite = can(PERMS.changeSite)
  const canDeleteSite = can(PERMS.deleteSite)

  const {
    register: registerSite,
    handleSubmit: handleSubmitSite,
    reset: resetSite,
    setError: setSiteError,
    formState: { errors: siteErrors, isSubmitting: siteIsSubmitting },
  } = useForm({
    resolver: zodResolver(siteFormSchema),
    defaultValues: toSiteFormValues(null),
  })

  const detailQuery = useQuery({
    queryKey: ['sites', siteId],
    queryFn: async () => {
      const { data } = await fetchSiteDetail(siteId)
      return data
    },
    enabled: Boolean(canViewSite && siteId),
  })

  const site = detailQuery.data

  const updateSiteMutation = useMutation({
    mutationFn: (values) => updateSite(siteId, toSitePayload(values)),
  })

  const deleteSiteMutation = useMutation({
    mutationFn: () => deleteSite(siteId),
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

  const onDeleteSite = async () => {
    const ok = await confirmAction({
      title: 'সাইট মুছে ফেলবেন?',
      text: 'এই কাজটি ফিরিয়ে আনা যাবে না।',
      confirmText: 'ডিলিট করুন',
      danger: true,
    })
    if (!ok) return
    setSiteApiError(null)
    try {
      await deleteSiteMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
      try {
        await bootstrapProfile()
      } catch {
        // ignore
      }
      toastSuccess('সাইট ডিলিট হয়েছে')
      navigate(paths.sites, { replace: true })
    } catch (err) {
      setSiteApiError(parseApiError(err))
    }
  }

  const onDeleteSiteRef = useRef(onDeleteSite)
  onDeleteSiteRef.current = onDeleteSite
  const openEditModalRef = useRef(openEditModal)
  openEditModalRef.current = openEditModal

  useEffect(() => {
    setTitle?.('সাইট বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, siteId])

  const canUpdateFromMenu = canChangeSite && site && !site.is_closed

  useEffect(() => {
    if (!siteId) {
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
          {/* {canDeleteSite ? (
            <li>
              <button
                type="button"
                className="text-error"
                disabled={deleteSiteMutation.isPending}
                onClick={() => void onDeleteSiteRef.current()}
              >
                ডিলিট
              </button>
            </li>
          ) : null} */}
        </ul>
      </DetailMenuButton>,
    )
    return () => setHeaderMenu?.(null)
  }, [
    siteId,
    setHeaderMenu,
    canUpdateFromMenu,
    canDeleteSite,
    deleteSiteMutation.isPending,
  ])

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

  const siteBusy = siteIsSubmitting || updateSiteMutation.isPending
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
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto space-y-4 relative pb-20">
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
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8">সাইট আপডেট</h3>

          <ApiErrorAlert error={siteApiError} className="mb-3" />

          <form
            className="flex flex-col gap-3"
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

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={closeEditModal}
                disabled={siteBusy}
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={siteBusy || site.is_closed}
              >
                {siteBusy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                নিশ্চিত
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  )
}
