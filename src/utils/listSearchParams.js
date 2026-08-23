export const sameSearchParams = (a, b) => {
  const keys = new Set([...a.keys(), ...b.keys()])
  for (const key of keys) {
    if ((a.get(key) ?? '') !== (b.get(key) ?? '')) return false
  }
  return true
}

export const readEnumParam = (params, key, allowed, fallback) => {
  const value = params.get(key)
  if (value && allowed.has(value)) return value
  return fallback
}

export const readPageParam = (params) => {
  const raw = Number(params.get('page'))
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
}

export const readQueryParam = (params, key = 'q') =>
  (params.get(key) ?? '').trim()

export const toListSearchParams = ({ q, page, extras = {} }) => {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  for (const [key, value] of Object.entries(extras)) {
    if (value != null && value !== '' && value !== 'all') {
      params.set(key, String(value))
    }
  }
  if (page > 1) params.set('page', String(page))
  return params
}
