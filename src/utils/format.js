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
