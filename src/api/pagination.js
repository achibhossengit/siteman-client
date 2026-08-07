/** Normalize list vs paginated DRF responses. */

export const asList = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

export const asPage = (data) => {
  const results = asList(data)
  return {
    results,
    count: typeof data?.count === 'number' ? data.count : results.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
  }
}
