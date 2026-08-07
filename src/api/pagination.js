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
 * Walk paginated list endpoints until exhausted.
 * `requestPage(page)` should return axios response (`{ data }`).
 */
export const fetchAllPages = async (requestPage, { pageSize = 100 } = {}) => {
  const all = []
  let page = 1
  for (;;) {
    const { data } = await requestPage(page, pageSize)
    const { results, next } = asPage(data)
    all.push(...results)
    if (!next || !results.length) break
    page += 1
  }
  return all
}
