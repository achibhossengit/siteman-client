import { API_BASE } from '../api/endpoints.js'

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PHOTO_NAME = /\.(jpe?g|png|webp)$/i

export const PHOTO_TYPE_MESSAGE = 'শুধু জেপিজি, পিএনজি বা ওয়েবপি ছবি দিন'
export const PHOTO_TOO_LARGE_MESSAGE = 'ছবিটি ৫ এমবির বেশি হতে পারবে না'

/** Resolve API media URI (absolute or relative) for <img src>. */
export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^(https?:\/\/|blob:|data:)/i.test(trimmed)) return trimmed
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (!API_BASE) return path
  return `${API_BASE.replace(/\/$/, '')}${path}`
}

export const initialsFromName = (name) => {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join('')
  const first = Array.from(parts[0])[0] ?? ''
  const last = Array.from(parts[parts.length - 1])[0] ?? ''
  return `${first}${last}`
}

export const validatePhotoFile = (file) => {
  if (!(file instanceof File)) return 'ছবি দিন'
  if (file.size <= 0) return 'ফাইলটি খালি। অন্য ফাইল দিন।'
  if (file.size > PHOTO_MAX_BYTES) return PHOTO_TOO_LARGE_MESSAGE
  const type = String(file.type || '').toLowerCase()
  const name = String(file.name || '')
  const typeOk = type ? PHOTO_TYPES.has(type) : PHOTO_NAME.test(name)
  if (!typeOk) return PHOTO_TYPE_MESSAGE
  return null
}
