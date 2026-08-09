import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { humanizeApiError, parseApiError } from '../api/errors.js'

export const toastApiError = (error) => {
  const parsed = error?.errors ? error : parseApiError(error)
  toast.error(humanizeApiError(parsed))
  return parsed
}

export const toastSuccess = (message, options) => toast.success(message, options)

export const toastInfo = (message, options) => toast(message, options)

// A <dialog> opened with showModal() lives in the browser top layer, which no
// z-index can beat. Rendering the alert inside that dialog puts it in the same
// layer so it stays on top of the modal that triggered it.
const topLayerTarget = () => {
  if (typeof document === 'undefined') return undefined
  const openDialogs = document.querySelectorAll('dialog[open]')
  return openDialogs.length ? openDialogs[openDialogs.length - 1] : undefined
}

export const confirmAction = async ({
  title,
  text,
  confirmText = 'নিশ্চিত',
  cancelText = 'বাতিল',
  danger = false,
}) => {
  const target = topLayerTarget()

  const result = await Swal.fire({
    target: target ?? 'body',
    heightAuto: !target,
    scrollbarPadding: !target,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? 'var(--color-error)' : 'var(--color-primary)',
    cancelButtonColor: 'var(--color-neutral)',
    reverseButtons: true,
    focusCancel: true,
    customClass: { popup: 'swal-confirm' },
  })

  return result.isConfirmed
}
