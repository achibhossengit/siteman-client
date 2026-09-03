import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ExternalLink, MessageCircle, X } from 'lucide-react'
import { updateCompany } from '../../api/company.js'
import {
  companyFormSchema,
  toCompanyFormValues,
  toCompanyPayload,
} from '../../api/types/company.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { DetailMenuButton } from '../../layouts/DetailLayout.jsx'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { toastSuccess } from '../../utils/feedback.js'
import { formatDateBn } from '../../utils/dateRange.js'
import { formatBnNumber, STATUS_LABEL } from '../../utils/format.js'
import { hasPermissionSuffix, PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'
import {
  companyFromProfile,
  getCompanyLimit,
} from '../../utils/subscription.js'
import { CompanyDeleteModal } from './CompanyDeleteModal.jsx'

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/KwhvUROanr1GpdjL2ydBGS'
const COMPANY_EDIT_MODAL_ID = 'company-edit-modal'

const dash = '—'

const formatLimit = (value) => {
  if (value == null) return dash
  return formatBnNumber(value)
}

const formatBool = (value) => {
  if (typeof value !== 'boolean') return dash
  return value ? STATUS_LABEL.active : STATUS_LABEL.inactive
}

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between gap-3 px-4 py-3 text-sm">
    <span className="text-base-content/70">{label}</span>
    <span className="font-medium text-right min-w-0 wrap-break-word">{value}</span>
  </div>
)

const InfoCard = ({ title, titleAction, children }) => (
  <section>
    {title ? (
      <div className="flex items-center justify-between gap-3 px-1 mb-1.5">
        <h2 className="text-sm font-medium text-base-content/55">{title}</h2>
        {titleAction}
      </div>
    ) : null}
    <div className="bg-base-100 rounded-2xl border border-base-300/80 overflow-hidden divide-y divide-base-300/70">
      {children}
    </div>
  </section>
)

export const CompanySettingsPage = () => {
  const navigate = useNavigate()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const { profile, bootstrapProfile, logout } = useAuth()
  const { can } = usePermissions()
  const editDialogRef = useRef(null)
  const deleteModalRef = useRef(null)
  const infoModalRef = useRef(null)
  const [apiError, setApiError] = useState(null)

  const company = companyFromProfile(profile)
  const companyName =
    company?.name ||
    (typeof profile?.company === 'string' ? profile.company : '') ||
    dash

  const canChangeCompany =
    can(PERMS.changeCompany) || hasPermissionSuffix(profile, 'change_company')
  const canDeleteCompany =
    can(PERMS.deleteCompany) || hasPermissionSuffix(profile, 'delete_company')

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(companyFormSchema),
    defaultValues: toCompanyFormValues(company),
  })

  const updateMutation = useMutation({
    mutationFn: (values) => updateCompany(toCompanyPayload(values)),
  })

  useEffect(() => {
    reset(toCompanyFormValues(company))
  }, [company, reset])

  const openEditModal = () => {
    if (!company) return
    setApiError(null)
    reset(toCompanyFormValues(company))
    editDialogRef.current?.showModal()
  }

  const closeEditModal = () => {
    editDialogRef.current?.close()
  }

  const onEditModalClose = () => {
    setApiError(null)
    reset(toCompanyFormValues(company))
  }

  const onConfirmEdit = handleSubmit(async (values) => {
    setApiError(null)
    try {
      await updateMutation.mutateAsync(values)
      try {
        await bootstrapProfile()
      } catch {
        // ignore
      }
      closeEditModal()
      toastSuccess('কোম্পানি আপডেট হয়েছে')
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  const handleCompanyDeleted = async () => {
    toastSuccess('কোম্পানি ডিলিট হয়েছে')
    try {
      await logout()
    } finally {
      navigate(paths.login, { replace: true })
    }
  }

  const openEditModalRef = useRef(openEditModal)
  openEditModalRef.current = openEditModal
  const openDeleteModalRef = useRef(() => deleteModalRef.current?.open())
  openDeleteModalRef.current = () => {
    setApiError(null)
    deleteModalRef.current?.open()
  }

  useEffect(() => {
    setTitle?.('কোম্পানি সেটিংস')
    return () => setTitle?.('')
  }, [setTitle])

  useEffect(() => {
    if (!canChangeCompany && !canDeleteCompany) {
      setHeaderMenu?.(null)
      return () => setHeaderMenu?.(null)
    }
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-48 p-1 shadow-md border border-base-300"
        >
          {canChangeCompany ? (
            <li>
              <button
                type="button"
                onClick={() => openEditModalRef.current()}
              >
                আপডেট
              </button>
            </li>
          ) : null}
          {canDeleteCompany ? (
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
  }, [setHeaderMenu, canChangeCompany, canDeleteCompany])

  const editBusy = isSubmitting || updateMutation.isPending
  const fieldClass = (hasError) =>
    `input input-bordered w-full ${hasError ? 'input-error' : ''}`

  return (
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 px-3 py-3">
      <ApiErrorAlert error={apiError} />

      <InfoCard>
        <InfoRow label="নাম" value={companyName} />
      </InfoCard>

      <InfoCard
        title="সাবস্ক্রিপশন"
        titleAction={
          <button
            type="button"
            className="text-sm font-medium text-primary shrink-0"
            onClick={() => infoModalRef.current?.showModal()}
          >
            আপডেট করুন
          </button>
        }
      >
        <InfoRow
          label="মেয়াদ"
          value={company?.paid_until ? formatDateBn(company.paid_until) : dash}
        />
        <InfoRow
          label="চালু ইউজার লিমিট"
          value={formatLimit(getCompanyLimit(profile, 'user'))}
        />
        <InfoRow
          label="চালু শ্রমিক লিমিট"
          value={formatLimit(getCompanyLimit(profile, 'labour'))}
        />
        <InfoRow
          label="সাইট লিমিট"
          value={formatLimit(getCompanyLimit(profile, 'site'))}
        />
      </InfoCard>

      <InfoCard title="সাইট কনফিগ">
        <InfoRow
          label="শ্রমিক সাইট পরিবর্তন"
          value={formatBool(company?.labour_transfer_allowed)}
        />
      </InfoCard>

      <dialog
        ref={editDialogRef}
        id={COMPANY_EDIT_MODAL_ID}
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

          <h3 className="font-semibold text-base mb-3 pr-8 shrink-0">
            কোম্পানি আপডেট
          </h3>

          <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

          <form
            className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault()
              return onConfirmEdit(e)
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">নাম</span>
              <input
                type="text"
                className={fieldClass(errors.name)}
                maxLength={255}
                {...register('name')}
              />
              {errors.name ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.name.message}
                </span>
              ) : null}
            </label>

            <label className="label cursor-pointer justify-start gap-3 py-2">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                {...register('labour_transfer_allowed')}
              />
              <span className="label-text">শ্রমিক সাইট পরিবর্তন</span>
            </label>

            <div className="mt-2">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!isDirty || editBusy}
              >
                {editBusy ? (
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

      <CompanyDeleteModal
        ref={deleteModalRef}
        company={company}
        onDeleted={handleCompanyDeleted}
        onError={setApiError}
      />

      <dialog ref={infoModalRef} className="modal">
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
          <h3 className="font-semibold text-base mb-3 pr-8">সাবস্ক্রিপশন</h3>
          <p className="text-sm text-base-content/80">
            সাবস্ক্রিপশন প্ল্যান আপডেট করতে এই হোয়াটসঅ্যাপ গ্রুপে যোগ দিয়ে
            মেসেজ দিন।
          </p>
          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-success btn-outline w-full mt-4 gap-2"
          >
            <MessageCircle className="size-4" strokeWidth={1.75} />
            গ্রুপে যোগ দিন
            <ExternalLink className="size-3.5 opacity-60" strokeWidth={1.75} />
          </a>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">বন্ধ</button>
        </form>
      </dialog>
    </div>
  )
}
