import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { deleteLabour } from '../../api/labours.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'

const DELETE_MODAL_ID = 'labour-delete-modal'

export const LabourDeleteModal = forwardRef(function LabourDeleteModal(
  { labourId, labour, onDeleted },
  ref,
) {
  const dialogRef = useRef(null)
  const [deleteApiError, setDeleteApiError] = useState(null)

  const deleteLabourMutation = useMutation({
    mutationFn: () => deleteLabour(labourId),
  })

  const {
    register: registerDelete,
    handleSubmit: handleSubmitDelete,
    reset: resetDelete,
    setError: setDeleteError,
    watch: watchDelete,
    formState: { errors: deleteErrors, isSubmitting: deleteSubmitting },
  } = useForm({
    defaultValues: { confirm_name: '' },
  })

  const deleteConfirmName = watchDelete('confirm_name') ?? ''
  const deleteNameReady =
    deleteConfirmName.trim() === (labour?.name ?? '').trim()
  const deleteBusy = deleteSubmitting || deleteLabourMutation.isPending

  const resetModal = () => {
    setDeleteApiError(null)
    resetDelete({ confirm_name: '' })
  }

  const closeModal = () => {
    dialogRef.current?.close()
  }

  useImperativeHandle(ref, () => ({
    open: () => {
      if (!labour) return
      resetModal()
      dialogRef.current?.showModal()
    },
    isDeleting: deleteLabourMutation.isPending,
  }))

  const onConfirmDelete = handleSubmitDelete(async (values) => {
    const expected = (labour?.name ?? '').trim()
    const typed = String(values.confirm_name ?? '').trim()
    if (!typed) {
      setDeleteError('confirm_name', {
        type: 'manual',
        message: 'শ্রমিকের নাম টাইপ করুন।',
      })
      return
    }
    if (typed !== expected) {
      setDeleteError('confirm_name', {
        type: 'manual',
        message: 'নাম মিলছে না। আবার চেষ্টা করুন।',
      })
      return
    }

    setDeleteApiError(null)
    try {
      await deleteLabourMutation.mutateAsync()
      closeModal()
      await onDeleted?.()
    } catch (err) {
      const parsed = parseApiError(err)
      setDeleteApiError(parsed)
      applyFieldErrors(parsed, setDeleteError)
    }
  })

  if (!labour) return null

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
          শ্রমিক ডিলিট করবেন?
        </h3>

        <p className="text-sm text-base-content/70 mb-3 shrink-0">
          ডিলিট করা একাউন্ট ফিরিয়ে আনা যাবে না। নিশ্চিত করতে শ্রমিকের নাম
          টাইপ করুন।
        </p>
        <p className="text-sm font-medium mb-3 shrink-0 truncate">
          {labour.name}
        </p>

        <ApiErrorAlert error={deleteApiError} />

        <form
          className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
          onSubmit={(e) => {
            e.preventDefault()
            return onConfirmDelete(e)
          }}
          noValidate
        >
          <label className="form-control w-full">
            <span className="label-text mb-1">শ্রমিকের নাম</span>
            <input
              type="text"
              autoComplete="off"
              maxLength={255}
              className={`input input-bordered w-full ${
                deleteErrors.confirm_name ? 'input-error' : ''
              }`}
              placeholder="নাম টাইপ করুন"
              {...registerDelete('confirm_name')}
            />
            {deleteErrors.confirm_name ? (
              <span className="label-text-alt text-error mt-1">
                {deleteErrors.confirm_name.message}
              </span>
            ) : null}
          </label>

          <div className="mt-2 shrink-0">
            <button
              type="submit"
              className="btn btn-error w-full"
              disabled={!deleteNameReady || deleteBusy}
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
