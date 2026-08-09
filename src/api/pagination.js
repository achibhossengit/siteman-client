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

/**
 * Walk a paginated list endpoint until `next` is null.
 * `fetchPage({ page, page_size })` must resolve to `{ data }` where data is
 * either a page object or a bare array (via asPage/asList).
 */
export const fetchAllPages = async (
  fetchPage,
  { page_size = 100, max_pages = 200 } = {},
) => {
  const results = []
  let page = 1
  for (;;) {
    const { data } = await fetchPage({ page, page_size })
    const chunk = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
        ? data.results
        : []
    results.push(...chunk)
    if (Array.isArray(data) || !data?.next) break
    page += 1
    if (page > max_pages) break
  }
  return results
}
