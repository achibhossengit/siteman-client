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

export const toastError = (message, options) => toast.error(message, options)

// A <dialog> opened with showModal() lives in the browser top layer, which no
// z-index can beat. Rendering the alert inside that dialog puts it in the same
// layer so it stays on top of the modal that triggered it.
const topLayerTarget = () => {
  if (typeof document === 'undefined') return undefined
  const openDialogs = document.querySelectorAll('dialog[open]')
  return openDialogs.length ? openDialogs[openDialogs.length - 1] : undefined
}

export const alertError = async ({
  title = 'সমস্যা হয়েছে',
  text,
  confirmText = 'ঠিক আছে',
} = {}) => {
  const target = topLayerTarget()
  const message = text || humanizeApiError(null)

  await Swal.fire({
    target: target ?? 'body',
    heightAuto: !target,
    scrollbarPadding: !target,
    icon: 'error',
    title,
    text: message,
    confirmButtonText: confirmText,
    confirmButtonColor: 'var(--color-error)',
    customClass: { popup: 'swal-confirm' },
  })
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

export { escapeHtml }

/** Simple one-button notice — no icon/title. Prefer `html` for bold parts. */
export const alertNotice = async ({
  text,
  html,
  confirmText = 'ঠিক আছে',
} = {}) => {
  const target = topLayerTarget()

  await Swal.fire({
    target: target ?? 'body',
    heightAuto: !target,
    scrollbarPadding: !target,
    title: false,
    text: html ? undefined : text,
    html: html || undefined,
    confirmButtonText: confirmText,
    confirmButtonColor: 'var(--color-primary)',
    customClass: { popup: 'swal-confirm' },
  })
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

/** Plan-cap notice. Confirm means go to company settings. */
export const alertSubscriptionLimit = async (message) => {
  const target = topLayerTarget()

  const result = await Swal.fire({
    target: target ?? 'body',
    heightAuto: !target,
    scrollbarPadding: !target,
    title: 'সাবস্ক্রিপশন লিমিট পূর্ণ',
    text: message,
    showCancelButton: true,
    confirmButtonText: 'আপডেট করুন',
    cancelButtonText: 'এখন না',
    confirmButtonColor: 'var(--color-primary)',
    cancelButtonColor: 'var(--color-neutral)',
    reverseButtons: true,
    focusCancel: true,
    customClass: { popup: 'swal-confirm' },
  })

  return result.isConfirmed
}
