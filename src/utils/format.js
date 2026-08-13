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

/** Shared display identities — keep UI copy consistent. */
export const STATUS_LABEL = {
  active: 'চালু',
  inactive: 'বন্ধ',
  closed: 'কমপ্লিট',
  done: 'সম্পন্ন',
}

/** Display when billing_category is null. */
export const NULL_BILLING_LABEL = 'জেনারেল বিলিং'

/** Display when labour current_site / site assignment is null. */
export const NULL_SITE_LABEL = 'সাইট নেই'

/**
 * Fixed-length label for narrow table cells.
 * "kalam ahmed khan" → "kalam ah…"
 */
export const concatName = (name, maxLen = 10) => {
  if (name == null || name === '') return '—'
  const text = String(name).trim()
  if (!text) return '—'
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}…`
}

/** @see concatName */
export const concatBillingName = concatName

/** Labour names: first + last usually fit at 14 (e.g. "আরিফ উদ্দিন"). */
export const concatLabourName = (name) => concatName(name, 14)
