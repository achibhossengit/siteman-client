import { usePhotoPicker } from './usePhotoPicker.js'

/** Local file preview + remove flag for cash/receipt image pickers. */
export const useFilePicker = (currentFile) => {
  const {
    photoFile: file,
    removePhoto: removeFile,
    photoError: fileError,
    setPhotoError: setFileError,
    previewSrc,
    photoDirty: fileDirty,
    resetPhotoState: resetFileState,
    onSelectPhoto: onSelectFile,
    onRemovePhoto: onRemoveFile,
  } = usePhotoPicker(currentFile)

  return {
    file,
    removeFile,
    fileError,
    setFileError,
    previewSrc,
    fileDirty,
    resetFileState,
    onSelectFile,
    onRemoveFile,
  }
}
