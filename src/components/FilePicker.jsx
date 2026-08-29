import { useState } from 'react'
import { X } from 'lucide-react'
import { PHOTO_ACCEPT, resolveMediaUrl } from '../utils/media.js'
import { ImageLightbox } from './ImageLightbox.jsx'

const TILE = 'relative size-20 shrink-0 overflow-hidden rounded-xl'

const CameraPlusIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
    <path d="M19 2v4M17 4h4" />
  </svg>
)

export const FilePicker = ({
  previewSrc,
  error,
  disabled = false,
  onSelect,
  onRemove,
  alt = 'ছবি',
}) => {
  const [viewerOpen, setViewerOpen] = useState(false)
  const src = resolveMediaUrl(previewSrc)
  const showAdd = !disabled && !src

  if (!src && !showAdd) {
    return error ? (
      <div className="label-text-alt text-error">{error}</div>
    ) : null
  }

  return (
    <div className="w-full">
      <div className="flex items-start gap-2">
        {src ? (
          <div className={TILE}>
            <button
              type="button"
              className="block size-full"
              aria-label="ছবি দেখুন"
              onClick={() => setViewerOpen(true)}
            >
              <img src={src} alt={alt} className="size-full object-cover" />
            </button>
            {!disabled ? (
              <button
                type="button"
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-white text-neutral shadow-sm"
                aria-label="সরান"
                onClick={(event) => {
                  event.stopPropagation()
                  setViewerOpen(false)
                  onRemove?.()
                }}
              >
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            ) : null}
          </div>
        ) : null}

        {showAdd ? (
          <label
            className={`${TILE} flex cursor-pointer items-center justify-center border border-base-content/30 text-base-content/45`}
          >
            <CameraPlusIcon className="size-8" />
            <span className="sr-only">ছবি যোগ করুন</span>
            <input
              type="file"
              accept={PHOTO_ACCEPT}
              className="hidden"
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.files?.[0]
                event.target.value = ''
                if (next) onSelect?.(next)
              }}
            />
          </label>
        ) : null}
      </div>
      {error ? (
        <div className="label-text-alt text-error mt-1">{error}</div>
      ) : null}
      <ImageLightbox
        src={src}
        alt={alt}
        open={viewerOpen && Boolean(src)}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  )
}
