import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { fetchLabours } from '../../api/labours.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { ListPagination } from '../../components/ListPagination.jsx'
import { PersonAvatar } from '../../components/PersonAvatar.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { useAssignedSites } from '../../hooks/useSites.js'
import { formatBnNumber, NULL_SITE_LABEL, STATUS_LABEL } from '../../utils/format.js'
import {
  readEnumParam,
  readPageParam,
  readQueryParam,
  sameSearchParams,
  toListSearchParams,
} from '../../utils/listSearchParams.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'
import { LabourCreateModal } from './LabourCreateModal.jsx'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 400
const SITE_FILTER_MODAL_ID = 'labours_site_filter_modal'
const SITE_MODAL_TABS = {
  status: 'status',
  site: 'site',
}

const ACCOUNT_FILTER_OPTIONS = [
  { value: 'all', label: 'সব অ্যাকাউন্ট' },
  { value: 'active', label: `${STATUS_LABEL.active} অ্যাকাউন্ট` },
  { value: 'inactive', label: `${STATUS_LABEL.inactive} অ্যাকাউন্ট` },
]

const accountParams = (filter) => {
  if (filter === 'active') return { is_active: true }
  if (filter === 'inactive') return { is_active: false }
  return {}
}

const ACCOUNT_VALUES = new Set(ACCOUNT_FILTER_OPTIONS.map((o) => o.value))

const readSiteFilter = (params) => {
  const value = params.get('site')
  if (!value || value === 'all') return 'all'
  return value
}

export const LaboursPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { setTitle } = useOutletContext()
  const { can, isCompanyAdmin } = usePermissions()
  const createModalRef = useRef(null)
  const nameSearchRef = useRef(null)
  const skipPageReset = useRef(true)
  const { assignedSites, getSiteName } = useAssignedSites({
    includeClosed: true,
  })
  const [nameQuery, setNameQuery] = useState(() => readQueryParam(searchParams))
  const [search, setSearch] = useState(() => readQueryParam(searchParams))
  const [nameSearchOpen, setNameSearchOpen] = useState(() =>
    Boolean(readQueryParam(searchParams)),
  )
  const [siteFilter, setSiteFilter] = useState(() => readSiteFilter(searchParams))
  const [accountFilter, setAccountFilter] = useState(() =>
    readEnumParam(searchParams, 'status', ACCOUNT_VALUES, 'all'),
  )
  const [siteModalTab, setSiteModalTab] = useState(SITE_MODAL_TABS.status)
  const [page, setPage] = useState(() => readPageParam(searchParams))

  const canViewLabour = can(PERMS.viewLabour)
  const canAddLabour = can(PERMS.addLabour)

  const siteFilterOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'সব সাইট' }]
    if (isCompanyAdmin) {
      options.push({ value: 'unassigned', label: NULL_SITE_LABEL })
    }
    for (const s of assignedSites) {
      options.push({
        value: String(s.id),
        label: getSiteName(s.id),
      })
    }
    return options
  }, [assignedSites, isCompanyAdmin, getSiteName])

  useEffect(() => {
    setTitle?.('শ্রমিক ম্যানেজ')
    return () => setTitle?.('')
  }, [setTitle])

  // Debounce search: request only after typing stops.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(nameQuery.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [nameQuery])

  useEffect(() => {
    const next = toListSearchParams({
      q: search,
      page,
      extras: { status: accountFilter, site: siteFilter },
    })
    if (!sameSearchParams(next, searchParams)) {
      setSearchParams(next, { replace: true })
    }
  }, [search, siteFilter, accountFilter, page, searchParams, setSearchParams])

  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false
      return
    }
    setPage(1)
  }, [search, siteFilter, accountFilter])

  useEffect(() => {
    if (!nameSearchOpen) return
    nameSearchRef.current?.focus()

    const onPointerDown = (event) => {
      const el = nameSearchRef.current
      if (!el) return
      if (el === event.target || el.contains(event.target)) return
      if (el.value !== '') return
      setNameSearchOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [nameSearchOpen])

  const laboursQuery = useQuery({
    queryKey: [
      'labours',
      'list',
      { page, page_size: PAGE_SIZE, search, siteFilter, accountFilter },
    ],
    queryFn: async () => {
      const { data } = await fetchLabours({
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(siteFilter !== 'all' ? { current_site: siteFilter } : {}),
        ...accountParams(accountFilter),
      })
      return data
    },
    enabled: canViewLabour,
    placeholderData: (previousData) => previousData,
  })

  const siteLabel = (id) => getSiteName(id)

  const pageData = laboursQuery.data ?? {
    results: [],
    count: 0,
    next: null,
    previous: null,
  }
  const rows = pageData.results ?? []
  const totalCount = pageData.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const slOffset = (page - 1) * PAGE_SIZE

  if (!canViewLabour) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (laboursQuery.isLoading && !laboursQuery.data) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (laboursQuery.isError) {
    return <ApiErrorAlert error={parseApiError(laboursQuery.error)} />
  }

  const emptyLabel = search
    ? 'কোনো মিল পাওয়া যায়নি।'
    : siteFilter !== 'all' || accountFilter !== 'all'
      ? 'এই ফিল্টারে কোনো শ্রমিক নেই।'
      : 'কোনো শ্রমিক নেই।'
  const siteHeaderLabel =
    siteFilter === 'all' && accountFilter === 'all'
      ? 'বর্তমান সাইট'
      : 'বর্তমান সাইট*'

  return (
    <section className="relative flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="table table-sm sm:table-md w-full">
          <thead className="sticky top-0 z-10 bg-base-200">
            <tr className="border-b-2 border-base-300">
              <th className="w-12">
                <span className="inline-flex h-8 items-center">নং</span>
              </th>
              <th className="min-w-0">
                <div className="grid h-8 w-full min-w-0 items-center overflow-hidden">
                  <button
                    type="button"
                    className={`col-start-1 row-start-1 inline-flex h-8 items-center text-left ${
                      nameSearchOpen ? 'invisible pointer-events-none' : ''
                    }`}
                    tabIndex={nameSearchOpen ? -1 : 0}
                    onClick={() => setNameSearchOpen(true)}
                  >
                    নাম
                  </button>
                  <input
                    ref={nameSearchRef}
                    type="search"
                    size={1}
                    aria-hidden={!nameSearchOpen}
                    tabIndex={nameSearchOpen ? 0 : -1}
                    className={`col-start-1 row-start-1 input input-bordered input-sm h-8 min-h-8 max-h-8 w-full min-w-0 font-normal ${
                      nameSearchOpen ? '' : 'invisible pointer-events-none'
                    }`}
                    placeholder="নাম খুঁজুন"
                    aria-label="নাম খুঁজুন"
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                  />
                </div>
              </th>
              <th>
                <button
                  type="button"
                  className="inline-flex h-8 items-center"
                  onClick={() =>
                    document.getElementById(SITE_FILTER_MODAL_ID)?.showModal()
                  }
                >
                  {siteHeaderLabel}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const inactive = row.is_active === false
                return (
                  <tr
                    key={row.id}
                    className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                    onClick={() => navigate(paths.labourDetail(row.id))}
                  >
                    <td className="tabular-nums text-base-content/60">
                      {formatBnNumber(slOffset + index + 1)}
                    </td>
                    <td
                      className={`max-w-48 ${
                        inactive ? 'text-base-content/40' : ''
                      }`}
                      title={row.name}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PersonAvatar
                          photo={row.photo}
                          name={row.name}
                          size="xs"
                          className={inactive ? 'opacity-40' : ''}
                        />
                        <span className="font-medium truncate">{row.name}</span>
                      </div>
                    </td>
                    <td className="truncate text-sm text-base-content/80 max-w-40">
                      {siteLabel(row.current_site)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        <ListPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          isFetching={laboursQuery.isFetching}
          onPageChange={setPage}
        />
        <div className="h-20" aria-hidden />
      </div>

      {canAddLabour ? (
        <>
          <button
            type="button"
            className="btn btn-primary btn-circle btn-lg absolute bottom-4 right-4 z-40 shadow-lg"
            aria-label="নতুন শ্রমিক"
            onClick={() => createModalRef.current?.open()}
          >
            <Plus className="size-7" strokeWidth={2} />
          </button>
          <LabourCreateModal ref={createModalRef} />
        </>
      ) : null}

      <dialog id={SITE_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>
          <h3 className="font-semibold text-base mb-3 pr-8 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={
                  siteModalTab === SITE_MODAL_TABS.status
                    ? 'text-primary'
                    : 'text-base-content/50 hover:text-base-content'
                }
                onClick={() => setSiteModalTab(SITE_MODAL_TABS.status)}
              >
                স্ট্যাটাস
              </button>
              <button
                type="button"
                className={
                  siteModalTab === SITE_MODAL_TABS.site
                    ? 'text-primary'
                    : 'text-base-content/50 hover:text-base-content'
                }
                onClick={() => setSiteModalTab(SITE_MODAL_TABS.site)}
              >
                বর্তমান সাইট
              </button>
            </div>
          </h3>
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {siteModalTab === SITE_MODAL_TABS.status
                ? ACCOUNT_FILTER_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="inline-flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={accountFilter === opt.value}
                        onChange={() => setAccountFilter(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))
                : siteFilterOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="inline-flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={siteFilter === opt.value}
                        onChange={() => setSiteFilter(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
            </div>
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>
    </section>
  )
}
