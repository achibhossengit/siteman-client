import { Pencil, Trash2 } from 'lucide-react'
import { PersonAvatar } from './PersonAvatar.jsx'
import { PHOTO_ACCEPT } from '../utils/media.js'

export const PhotoPicker = ({
  previewSrc,
  name = '',
  error,
  disabled = false,
  onSelect,
  onRemove,
}) => {
  const canRemove = Boolean(previewSrc) && !disabled

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative inline-block">
        <PersonAvatar
          photo={previewSrc}
          name={name}
          size="xl"
          shape="square"
          alt={name || 'প্রোফাইল ছবি'}
        />
        <button
          type="button"
          className="btn btn-circle btn-xs btn-error absolute bottom-1.5 left-1.5"
          aria-label="সরান"
          disabled={!canRemove}
          onClick={() => onRemove?.()}
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
        </button>
        <label
          className={`btn btn-circle btn-xs btn-primary absolute bottom-1.5 right-1.5 ${
            disabled ? 'btn-disabled' : ''
          }`}
        >
          <Pencil className="size-3.5" strokeWidth={1.75} />
          <span className="sr-only">পরিবর্তন</span>
          <input
            type="file"
            accept={PHOTO_ACCEPT}
            className="hidden"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onSelect?.(file)
            }}
          />
        </label>
      </div>
      {error ? (
        <div className="label-text-alt text-error mt-1 text-center">{error}</div>
      ) : null}
    </div>
  )
}
