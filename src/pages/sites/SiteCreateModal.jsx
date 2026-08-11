import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { createSite } from '../../api/sites.js'
import { siteFormSchema, toSitePayload } from '../../api/types/site.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { toastSuccess } from '../../utils/feedback.js'

const emptyValues = {
  name: '',
  is_active: true,
}

export const SiteCreateModal = forwardRef(function SiteCreateModal(_, ref) {
  const queryClient = useQueryClient()
  const dialogRef = useRef(null)
  const { bootstrapProfile } = useAuth()
  const [apiError, setApiError] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(siteFormSchema),
    defaultValues: emptyValues,
  })

  const mutation = useMutation({
    mutationFn: (values) => createSite(toSitePayload(values)),
  })

  const busy = isSubmitting || mutation.isPending

  const resetModal = () => {
    setApiError(null)
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

  const saveSite = async (values, { createAnother }) => {
    setApiError(null)
    try {
      await mutation.mutateAsync(values)
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
      try {
        await bootstrapProfile()
      } catch {
        // list still refreshed; selector may lag until next profile fetch
      }
      toastSuccess('সাইট তৈরি হয়েছে')
      if (createAnother) {
        reset(emptyValues)
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
    saveSite(values, { createAnother: false }),
  )

  const onSaveAndCreateAnother = handleSubmit((values) =>
    saveSite(values, { createAnother: true }),
  )

  return (
    <dialog ref={dialogRef} className="modal" onClose={resetModal}>
      <div className="modal-box max-w-sm max-h-[min(28rem,90vh)] flex flex-col">
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
          নতুন সাইট
        </h3>

        <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

        <form
          className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
          onSubmit={onSubmit}
          noValidate
        >
          <label className="form-control w-full">
            <span className="label-text mb-1">সাইটের নাম</span>
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
              disabled={busy}
              onClick={onSaveAndCreateAnother}
            >
              আরেকটি
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={busy}
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
