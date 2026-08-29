import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { resolveMediaUrl } from '../utils/media.js'

const overlayHost = () => {
  if (typeof document === 'undefined') return null
  return document.querySelector('dialog.modal[open]') ?? document.body
}

/** Full-screen image viewer in the same tab. */
export const ImageLightbox = ({ src, alt = 'ছবি', open, onClose }) => {
  const resolved = resolveMediaUrl(src)
  const host = overlayHost()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose?.()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open || !resolved || !host) return null

  const inDialog = host instanceof HTMLDialogElement

  return createPortal(
    <div
      className={
        inDialog
          ? 'image-lightbox-overlay'
          : 'image-lightbox-overlay image-lightbox-overlay--page'
      }
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={() => onClose?.()}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full bg-black/45 text-white"
        aria-label="বন্ধ"
        autoFocus
        onClick={(event) => {
          event.stopPropagation()
          onClose?.()
        }}
      >
        <X className="size-7" strokeWidth={2} />
      </button>
      <img
        src={resolved}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    host,
  )
}
