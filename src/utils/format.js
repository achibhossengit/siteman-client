/** Format numbers with Bengali digits (e.g. 13079 → ১৩,০৭৯). */
export const formatBnNumber = (value, options = {}) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return formatBnNumber(0, options)
  return new Intl.NumberFormat('bn-BD', options).format(n)
}

/** e.g. (+) ০  or  (-) ৭,৯৩০ */
export const formatBnSigned = (value, { showPlus = true } = {}) => {
  const n = Number(value) || 0
  const abs = formatBnNumber(Math.abs(n))
  if (n < 0) return `(-) ${abs}`
  if (showPlus) return `(+) ${abs}`
  return abs
}

/** Display label when billing_category is null. */
export const NULL_BILLING_LABEL = 'জেনারেল বিলিং'

/**
 * Compact billing label for narrow table cells.
 * "Basement Nothing to say some" → "BNtss"
 */
export const concatBillingName = (name) => {
  if (name == null || name === '') return '—'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) {
    const word = parts[0]
    return word.length > 8 ? `${word.slice(0, 6)}…` : word
  }
  return parts.map((part) => part[0] ?? '').join('')
}
