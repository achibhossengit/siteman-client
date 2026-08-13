import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { createLabour } from '../../api/labours.js'
import {
  DEFAULT_ATTENDANCE_OPTIONS,
  LABOUR_FORM_DEFAULTS,
  createLabourFormSchema,
  toLabourPayload,
} from '../../api/types/labour.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { useAssignedSites, useSitesLookup } from '../../hooks/useSites.js'
import { formatBnNumber, NULL_SITE_LABEL } from '../../utils/format.js'
import { toastSuccess } from '../../utils/feedback.js'

export const LabourCreateModal = forwardRef(function LabourCreateModal(_, ref) {
  const queryClient = useQueryClient()
  const dialogRef = useRef(null)
  const { isCompanyAdmin } = usePermissions()
  const [apiError, setApiError] = useState(null)

  const requireSite = !isCompanyAdmin

  const { sites: allSites, isLoading: sitesLoading } = useSitesLookup({
    enabled: isCompanyAdmin,
  })
  const { assignedSites, isLoading: assignedLoading } = useAssignedSites({
    includeClosed: true,
    enabled: !isCompanyAdmin,
  })

  const siteOptions = isCompanyAdmin ? allSites : assignedSites
  const sitesBusy = isCompanyAdmin ? sitesLoading : assignedLoading
  const showUnassignedOption = isCompanyAdmin || siteOptions.length === 0

  const initialSite = useMemo(() => {
    if (isCompanyAdmin) return ''
    if (assignedSites.length === 0) return ''
    return String(assignedSites[0].id)
  }, [isCompanyAdmin, assignedSites])

  const schema = useMemo(
    () => createLabourFormSchema({ requireSite }),
    [requireSite],
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ...LABOUR_FORM_DEFAULTS,
      current_site: initialSite,
    },
  })

  useEffect(() => {
    setValue('current_site', initialSite)
  }, [initialSite, setValue])

  const watched = watch()
  const formReady = useMemo(() => {
    const parsed = schema.safeParse({
      ...watched,
      is_active: Boolean(watched.is_active),
    })
    return parsed.success
  }, [watched, schema])

  const mutation = useMutation({
    mutationFn: (values) => createLabour(toLabourPayload(values)),
  })

  const busy = isSubmitting || mutation.isPending
  const saveDisabled = busy || !formReady

  const blankForm = () => ({
    ...LABOUR_FORM_DEFAULTS,
    current_site: initialSite,
  })

  const resetModal = () => {
    setApiError(null)
    reset(blankForm())
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

  const saveLabour = async (values, { createAnother }) => {
    setApiError(null)
    try {
      await mutation.mutateAsync(values)
      await queryClient.invalidateQueries({ queryKey: ['labours'] })
      toastSuccess('শ্রমিক তৈরি হয়েছে')
      if (createAnother) {
        reset(blankForm())
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
    saveLabour(values, { createAnother: false }),
  )

  const onSaveAndCreateAnother = handleSubmit((values) =>
    saveLabour(values, { createAnother: true }),
  )

  return (
    <dialog ref={dialogRef} className="modal" onClose={resetModal}>
      <div className="modal-box max-w-md max-h-[min(40rem,90vh)] flex flex-col">
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
          নতুন শ্রমিক
        </h3>

        <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

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
              {...register('name')}
            />
            {errors.name ? (
              <span className="label-text-alt text-error mt-1">
                {errors.name.message}
              </span>
            ) : null}
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1">বর্তমান সাইট</span>
            <select
              className={`select select-bordered w-full ${errors.current_site ? 'select-error' : ''}`}
              {...register('current_site')}
            >
              {showUnassignedOption ? (
                <option value="">{NULL_SITE_LABEL}</option>
              ) : null}
              {siteOptions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
            {sitesBusy ? (
              <span className="label-text-alt text-base-content/55 mt-1">
                সাইট লোড হচ্ছে…
              </span>
            ) : null}
            {errors.current_site ? (
              <span className="label-text-alt text-error mt-1">
                {errors.current_site.message}
              </span>
            ) : null}
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="form-control w-full min-w-0">
              <span className="label-text mb-1">হাজিরা</span>
              <select
                className={`select select-bordered w-full ${errors.default_attendance ? 'select-error' : ''}`}
                {...register('default_attendance')}
              >
                {DEFAULT_ATTENDANCE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {formatBnNumber(v, { maximumFractionDigits: 1 })}
                  </option>
                ))}
              </select>
              {errors.default_attendance ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.default_attendance.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full min-w-0">
              <span className="label-text mb-1">বেতন</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className={`input input-bordered w-full ${errors.default_salary ? 'input-error' : ''}`}
                {...register('default_salary')}
              />
              {errors.default_salary ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.default_salary.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full min-w-0">
              <span className="label-text mb-1">খোরাকি</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className={`input input-bordered w-full ${errors.default_fooding ? 'input-error' : ''}`}
                {...register('default_fooding')}
              />
              {errors.default_fooding ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.default_fooding.message}
                </span>
              ) : null}
            </label>
          </div>

          <label className="label cursor-pointer justify-start gap-3 py-2">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              {...register('is_active')}
            />
            <span className="label-text">চালু</span>
          </label>

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
      <div className="modal-backdrop">
        <button type="button" tabIndex={-1} aria-hidden="true" />
      </div>
    </dialog>
  )
})
