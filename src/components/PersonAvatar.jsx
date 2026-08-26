import { useEffect, useState } from 'react'
import { initialsFromName, resolveMediaUrl } from '../utils/media.js'

const SIZE_CLASS = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-14 h-14 text-base',
  form: 'w-16 h-16 text-lg',
  lg: 'w-24 h-24 text-2xl',
  xl: 'w-32 h-32 text-3xl',
}

const SHAPE_CLASS = {
  circle: 'rounded-full',
  square: 'rounded-sm',
}

export const PersonAvatar = ({
  photo,
  name = '',
  size = 'sm',
  shape = 'circle',
  className = '',
  alt,
}) => {
  const src = resolveMediaUrl(photo)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [src])

  const showImg = Boolean(src) && !broken
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.sm
  const shapeClass = SHAPE_CLASS[shape] ?? SHAPE_CLASS.circle
  const initials = initialsFromName(name)

  return (
    <div
      className={`avatar ${showImg ? '' : 'placeholder'} shrink-0 ${className}`}
    >
      <div
        className={`overflow-hidden ${sizeClass} ${shapeClass} ${
          showImg
            ? ''
            : 'bg-neutral text-neutral-content flex items-center justify-center'
        }`}
      >
        {showImg ? (
          <img
            src={src}
            alt={alt || name || ''}
            className="object-cover w-full h-full"
            onError={() => setBroken(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    </div>
  )
}
