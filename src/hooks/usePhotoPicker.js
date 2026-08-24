import { useCallback, useEffect, useState } from 'react'
import { validatePhotoFile } from '../utils/media.js'

/** Local file preview + remove flag for profile/labour photo pickers. */
export const usePhotoPicker = (currentPhoto) => {
  const [photoFile, setPhotoFile] = useState(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoObjectUrl, setPhotoObjectUrl] = useState(null)
  const [photoError, setPhotoError] = useState(null)

  useEffect(() => {
    return () => {
      if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl)
    }
  }, [photoObjectUrl])

  const resetPhotoState = useCallback(() => {
    setPhotoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPhotoFile(null)
    setRemovePhoto(false)
    setPhotoError(null)
  }, [])

  const onSelectPhoto = useCallback((file) => {
    const message = validatePhotoFile(file)
    if (message) {
      setPhotoError(message)
      return
    }
    setPhotoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setPhotoFile(file)
    setRemovePhoto(false)
    setPhotoError(null)
  }, [])

  const onRemovePhoto = useCallback(() => {
    setPhotoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPhotoFile(null)
    setRemovePhoto(true)
    setPhotoError(null)
  }, [])

  const previewSrc = photoObjectUrl
    ? photoObjectUrl
    : removePhoto
      ? null
      : currentPhoto ?? null

  return {
    photoFile,
    removePhoto,
    photoError,
    setPhotoError,
    previewSrc,
    photoDirty: Boolean(photoFile) || removePhoto,
    resetPhotoState,
    onSelectPhoto,
    onRemovePhoto,
  }
}
