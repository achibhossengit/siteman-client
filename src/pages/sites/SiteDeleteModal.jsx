import { forwardRef, useImperativeHandle, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { deleteSite } from '../../api/sites.js'
import { parseApiError } from '../../api/errors.js'

const DELETE_MODAL_ID = 'site-delete-modal'

const deleteSchema = z.object({
  password: z.string().min(1, 'পাসওয়ার্ড দিন'),
})

export const SiteDeleteModal = forwardRef(function SiteDeleteModal(
  { siteId, site, onDeleted, onError },
  ref,
) {
  const dialogRef = useRef(null)

  const deleteMutation = useMutation({
    mutationFn: (password) => deleteSite(siteId, { password }),
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

  const deletePassword = watchDelete('password')
  const deleteReady = (deletePassword ?? '').length > 0
  const deleteBusy = deleteSubmitting || deleteMutation.isPending

  const resetModal = () => {
    resetDelete({ password: '' })
  }

  const closeModal = () => {
    dialogRef.current?.close()
  }

  useImperativeHandle(ref, () => ({
    open: () => {
      if (!site) return
      resetModal()
      dialogRef.current?.showModal()
    },
    isDeleting: deleteMutation.isPending,
  }))

  const onConfirmDelete = handleSubmitDelete(async (values) => {
    try {
      await deleteMutation.mutateAsync(values.password)
      closeModal()
      await onDeleted?.()
    } catch (err) {
      const parsed = parseApiError(err)
      const passwordFieldError = parsed.fieldErrors?.password?.[0]
      const isPasswordError = Boolean(
        passwordFieldError ||
          parsed.hasCode?.('incorrect_password') ||
          parsed.hasCode?.('authentication_failed'),
      )

      if (isPasswordError) {
        setDeleteError('password', {
          type: 'server',
          message: passwordFieldError || 'পাসওয়ার্ড সঠিক নয়।',
        })
        return
      }

      closeModal()
      onError?.(parsed)
    }
  })

  if (!site) return null

  return (
    <dialog
      ref={dialogRef}
      id={DELETE_MODAL_ID}
      className="modal"
      onClose={resetModal}
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
          ডিলিট করা সাইট পুনরায় ফিরিয়ে আনা যাবে না। নিশ্চিত করতে আপনার পাসওয়ার্ড
          দিন।
        </p>

        <form
          className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
          onSubmit={(e) => {
            e.preventDefault()
            return onConfirmDelete(e)
          }}
          noValidate
        >
          <label className="form-control w-full">
            <input
              type="password"
              autoComplete="current-password"
              maxLength={20}
              className={`input input-bordered w-full ${
                deleteErrors.password ? 'input-error' : ''
              }`}
              placeholder="আপনার পাসওয়ার্ড দিন"
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
  )
})
