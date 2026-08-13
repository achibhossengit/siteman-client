import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, X } from 'lucide-react'
import {
  closeLabourSession,
  deleteLabour,
  deleteLabourSession,
  fetchLabourDetail,
  fetchLabourRunningSession,
  fetchLabourSession,
  fetchLabourSessions,
  updateLabour,
} from '../../api/labours.js'
import {
  DEFAULT_ATTENDANCE_OPTIONS,
  LABOUR_FORM_DEFAULTS,
  createLabourFormSchema,
  normalizeDefaultAttendance,
  toLabourPayload,
} from '../../api/types/labour.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { ListPagination } from '../../components/ListPagination.jsx'
import { DetailMenuButton } from '../../layouts/DetailLayout.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { useAssignedSites, useSitesLookup } from '../../hooks/useSites.js'
import { formatBnNumber, formatBnSigned, NULL_SITE_LABEL } from '../../utils/format.js'
import { confirmAction, toastSuccess } from '../../utils/feedback.js'
import { PERMS } from '../../utils/permissions.js'
import { paths } from '../../router/paths.js'

const PAGE_SIZE = 3
const EDIT_MODAL_ID = 'labour-edit-modal'

const toFormValues = (labour, { isCompanyAdmin, assignedSites } = {}) => {
  if (!labour) {
    return {
      ...LABOUR_FORM_DEFAULTS,
      current_site: isCompanyAdmin
        ? ''
        : assignedSites?.[0]
          ? String(assignedSites[0].id)
          : '',
    }
  }

  let current_site =
    labour.current_site != null ? String(labour.current_site) : ''

  if (!isCompanyAdmin) {
    const allowed = new Set((assignedSites ?? []).map((s) => String(s.id)))
    if (current_site && allowed.size && !allowed.has(current_site)) {
      current_site = assignedSites[0] ? String(assignedSites[0].id) : ''
    } else if (!current_site && assignedSites?.length) {
      current_site = String(assignedSites[0].id)
    }
  }

  return {
    name: labour.name ?? '',
    current_site,
    default_attendance: String(
      normalizeDefaultAttendance(labour.default_attendance ?? 1),
    ),
    default_salary: labour.default_salary ?? LABOUR_FORM_DEFAULTS.default_salary,
    default_fooding:
      labour.default_fooding ?? LABOUR_FORM_DEFAULTS.default_fooding,
    is_active: labour.is_active ?? true,
  }
}

const formatPeriodDate = (iso) => {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

const formatFullDate = (iso) => {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const isRunningSession = (session) =>
  Boolean(session?.is_running) || session?.id == null

const sessionKeyOf = (session) => {
  if (!session) return null
  return isRunningSession(session) ? 'running' : String(session.id)
}

const formatPeriod = (session) => {
  const start = formatPeriodDate(session?.start_date)
  if (isRunningSession(session)) return `${start} – চলমান`
  return `${start} – ${formatPeriodDate(session?.end_date)}`
}

const pickInitialSessionKey = (sessions) => {
  if (!sessions.length) return null
  const running = sessions.find((s) => isRunningSession(s))
  return sessionKeyOf(running ?? sessions[0])
}

export const LabourDetailPage = () => {
  const { labourId } = useParams()
  const navigate = useNavigate()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const queryClient = useQueryClient()
  const { can, isCompanyAdmin } = usePermissions()
  const editDialogRef = useRef(null)
  const [apiError, setApiError] = useState(null)
  const [sessionApiError, setSessionApiError] = useState(null)
  const [page, setPage] = useState(1)
  const [openSessionKey, setOpenSessionKey] = useState(null)

  const canViewLabour = can(PERMS.viewLabour)
  const canChangeLabour = can(PERMS.changeLabour)
  const canDeleteLabour = can(PERMS.deleteLabour)
  const canViewSessions = can(PERMS.viewLabourSession)
  const canCloseSession = can(PERMS.addLabourSession)
  const canDeleteSession = can(PERMS.deleteLabourSession)
  const requireSite = !isCompanyAdmin

  const { sites: allSites, getSiteName } = useSitesLookup({
    enabled: canViewLabour,
  })
  const { assignedSites } = useAssignedSites({
    includeClosed: true,
    enabled: canViewLabour && !isCompanyAdmin,
  })

  const siteOptions = isCompanyAdmin ? allSites : assignedSites
  const showUnassignedOption = isCompanyAdmin || siteOptions.length === 0

  const schema = useMemo(
    () => createLabourFormSchema({ requireSite }),
    [requireSite],
  )

  const formDefaults = useMemo(
    () => toFormValues(null, { isCompanyAdmin, assignedSites }),
    [isCompanyAdmin, assignedSites],
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: formDefaults,
  })

  const watched = watch()
  const formReady = useMemo(() => {
    const parsed = schema.safeParse({
      ...watched,
      is_active: Boolean(watched.is_active),
    })
    return parsed.success
  }, [watched, schema])

  const detailQuery = useQuery({
    queryKey: ['labours', labourId],
    queryFn: async () => {
      const { data } = await fetchLabourDetail(labourId)
      return data
    },
    enabled: Boolean(canViewLabour && labourId),
  })

  const sessionsQuery = useQuery({
    queryKey: ['labours', labourId, 'sessions', { page, page_size: PAGE_SIZE }],
    queryFn: async () => {
      const { data } = await fetchLabourSessions(labourId, {
        page,
        page_size: PAGE_SIZE,
      })
      return data
    },
    enabled: Boolean(canViewSessions && labourId),
    placeholderData: (previousData) => previousData,
  })

  const labour = detailQuery.data
  const sessionsPage = sessionsQuery.data ?? {
    results: [],
    count: 0,
    next: null,
    previous: null,
  }
  const sessions = sessionsPage.results ?? []
  const totalCount = sessionsPage.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1)

  const siteLabel = (id) => getSiteName(id)

  useEffect(() => {
    const keys = sessions.map(sessionKeyOf)
    if (!keys.length) {
      setOpenSessionKey(null)
      return
    }
    if (openSessionKey && keys.includes(openSessionKey)) return
    setOpenSessionKey(pickInitialSessionKey(sessions))
  }, [sessions, openSessionKey, page, labourId])

  const openIsRunning = openSessionKey === 'running'

  const sessionDetailQuery = useQuery({
    queryKey: ['labours', labourId, 'session-detail', openSessionKey],
    queryFn: async () => {
      if (openIsRunning) {
        const { data } = await fetchLabourRunningSession(labourId)
        return data ? { ...data, is_running: true } : null
      }
      const { data } = await fetchLabourSession(labourId, openSessionKey)
      return data
    },
    enabled: Boolean(canViewSessions && labourId && openSessionKey),
  })

  const updateMutation = useMutation({
    mutationFn: (values) => updateLabour(labourId, toLabourPayload(values)),
  })

  const deleteLabourMutation = useMutation({
    mutationFn: () => deleteLabour(labourId),
  })

  const closeSessionMutation = useMutation({
    mutationFn: () => closeLabourSession(labourId),
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => deleteLabourSession(labourId, id),
  })

  const invalidateLabour = () =>
    queryClient.invalidateQueries({ queryKey: ['labours', labourId] })

  const invalidateSessions = () =>
    queryClient.invalidateQueries({ queryKey: ['labours', labourId, 'sessions'] })

  const invalidateSessionActivities = () =>
    queryClient.invalidateQueries({ queryKey: ['activities'] })

  const openEditModal = () => {
    if (!labour) return
    setApiError(null)
    reset(toFormValues(labour, { isCompanyAdmin, assignedSites }))
    editDialogRef.current?.showModal()
  }

  const closeEditModal = () => {
    editDialogRef.current?.close()
  }

  const onEditModalClose = () => {
    setApiError(null)
    reset(toFormValues(labour, { isCompanyAdmin, assignedSites }))
  }

  const onDeleteLabour = async () => {
    const ok = await confirmAction({
      title: 'শ্রমিক মুছে ফেলবেন?',
      text: 'এই কাজটি ফিরিয়ে আনা যাবে না।',
      confirmText: 'ডিলিট করুন',
      danger: true,
    })
    if (!ok) return
    setApiError(null)
    try {
      await deleteLabourMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: ['labours'] })
      toastSuccess('শ্রমিক ডিলিট হয়েছে')
      navigate(paths.labours, { replace: true })
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }

  const onDeleteLabourRef = useRef(onDeleteLabour)
  onDeleteLabourRef.current = onDeleteLabour
  const openEditModalRef = useRef(openEditModal)
  openEditModalRef.current = openEditModal

  const onConfirmEdit = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await updateMutation.mutateAsync(values)
      reset(toFormValues(data, { isCompanyAdmin, assignedSites }))
      await invalidateLabour()
      closeEditModal()
      toastSuccess('শ্রমিক আপডেট হয়েছে')
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  const onCloseSession = async () => {
    const confirmed = await confirmAction({
      title: 'চলমান হিসাব ক্লোজ করবেন?',
      text: 'হাজিরা ও পেমেন্ট সিল হয়ে যাবে।',
      confirmText: 'ক্লোজ করুন',
    })
    if (!confirmed) return
    setSessionApiError(null)
    try {
      await closeSessionMutation.mutateAsync()
      await invalidateSessions()
      await invalidateLabour()
      await invalidateSessionActivities()
      toastSuccess('হিসাব ক্লোজ হয়েছে')
    } catch (error) {
      setSessionApiError(parseApiError(error))
    }
  }

  const onDeleteSession = async (sessionId) => {
    if (sessionId == null) return
    const confirmed = await confirmAction({
      title: 'হিসাব মুছে ফেলবেন?',
      text: 'এই কাজটি ফিরিয়ে আনা যাবে না।',
      confirmText: 'ডিলিট করুন',
      danger: true,
    })
    if (!confirmed) return
    setSessionApiError(null)
    try {
      await deleteSessionMutation.mutateAsync(sessionId)
      await invalidateSessions()
      await invalidateLabour()
      await invalidateSessionActivities()
      toastSuccess('হিসাব ডিলিট হয়েছে')
    } catch (error) {
      setSessionApiError(parseApiError(error))
    }
  }

  const onSessionsPageChange = (nextPage) => {
    setPage(nextPage)
    setOpenSessionKey(null)
  }

  useEffect(() => {
    setTitle?.('শ্রমিক বিবরণ')
    return () => setTitle?.('')
  }, [setTitle, labourId])

  useEffect(() => {
    if (!labourId || (!canChangeLabour && !canDeleteLabour)) {
      setHeaderMenu?.(null)
      return () => setHeaderMenu?.(null)
    }
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-48 p-1 shadow-md border border-base-300"
        >
          {canChangeLabour ? (
            <li>
              <button
                type="button"
                onClick={() => openEditModalRef.current()}
              >
                আপডেট
              </button>
            </li>
          ) : null}
          {canDeleteLabour ? (
            <li>
              <button
                type="button"
                className="text-error"
                disabled={deleteLabourMutation.isPending}
                onClick={() => void onDeleteLabourRef.current()}
              >
                ডিলিট
              </button>
            </li>
          ) : null}
        </ul>
      </DetailMenuButton>,
    )
    return () => setHeaderMenu?.(null)
  }, [
    labourId,
    setHeaderMenu,
    canChangeLabour,
    canDeleteLabour,
    deleteLabourMutation.isPending,
  ])

  useEffect(() => {
    if (labour) reset(toFormValues(labour, { isCompanyAdmin, assignedSites }))
  }, [labour, reset, isCompanyAdmin, assignedSites])

  if (!canViewLabour) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (detailQuery.isError) {
    return <ApiErrorAlert error={parseApiError(detailQuery.error)} />
  }

  if (!labour) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        শ্রমিক পাওয়া যায়নি।
      </div>
    )
  }

  const busy = isSubmitting || updateMutation.isPending
  const saveDisabled = busy || !formReady
  const fieldClass = (hasError, kind = 'input') =>
    [
      kind === 'select'
        ? 'select select-bordered w-full'
        : 'input input-bordered w-full',
      hasError ? (kind === 'select' ? 'select-error' : 'input-error') : '',
    ].join(' ')

  return (
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto space-y-4">
      <ApiErrorAlert error={apiError} />

      <section className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">শ্রমিকের নাম:</span>
          <span className="font-medium text-right">{labour.name || '—'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">বর্তমান সাইট:</span>
          <span className="font-medium text-right">
            {siteLabel(labour.current_site)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-base-content/70">
            হাজিরা:{' '}
            <span className="font-medium text-base-content tabular-nums">
              {formatBnNumber(labour.default_attendance, {
                maximumFractionDigits: 1,
              })}
            </span>
          </span>
          <span className="text-base-content/30">|</span>
          <span className="text-base-content/70">
            বেতন:{' '}
            <span className="font-medium text-base-content tabular-nums">
              {formatBnNumber(labour.default_salary)}
            </span>
          </span>
          <span className="text-base-content/30">|</span>
          <span>
            খোরাকি:{' '}
            <span className="font-medium text-base-content tabular-nums">
              {formatBnNumber(labour.default_fooding)}
            </span>
          </span>
        </div>
      </section>

      {canViewSessions ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">হিসাব সমূহ</h2>

          {sessionApiError ? <ApiErrorAlert error={sessionApiError} /> : null}

          {sessionsQuery.isLoading && !sessions.length ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : sessionsQuery.isError ? (
            <ApiErrorAlert error={parseApiError(sessionsQuery.error)} />
          ) : sessions.length === 0 ? (
            <div className="text-sm text-base-content/60 py-6 text-center">
              কোনো হিসাব নেই।
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((listSession) => {
                const key = sessionKeyOf(listSession)
                const isOpen = openSessionKey === key
                const running = isRunningSession(listSession)
                const detail =
                  isOpen && sessionDetailQuery.data
                    ? sessionDetailQuery.data
                    : listSession
                const locked = !running && Boolean(detail?.is_modified)
                const itemSessionId =
                  detail?.id ?? (!running && key !== 'running' ? key : null)
                const detailLoading =
                  isOpen &&
                  sessionDetailQuery.isLoading &&
                  !sessionDetailQuery.data

                return (
                  <div
                    key={key}
                    className={[
                      'collapse collapse-arrow border border-base-300',
                      isOpen ? 'collapse-open' : 'collapse-close',
                      running
                        ? 'bg-primary/10 border-primary/40'
                        : 'bg-base-100',
                    ].join(' ')}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      className="collapse-title min-h-0 py-3 px-3 text-sm font-medium"
                      onClick={() => setOpenSessionKey(key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setOpenSessionKey(key)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 pe-6">
                        <span className="whitespace-nowrap">
                          {formatPeriod(listSession)}
                        </span>
                        <span className="text-xs font-normal text-base-content/70 tabular-nums whitespace-nowrap">
                          পাওনা{' '}
                          {formatBnNumber(
                            listSession.cumulative_payable ??
                              listSession.payable,
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="collapse-content px-3">
                      {detailLoading ? (
                        <div className="flex justify-center py-6">
                          <span className="loading loading-spinner loading-sm text-primary" />
                        </div>
                      ) : sessionDetailQuery.isError && isOpen ? (
                        <ApiErrorAlert
                          error={parseApiError(sessionDetailQuery.error)}
                        />
                      ) : (
                        <div className="space-y-2 text-sm pb-1">
                          {locked ? (
                            <div className="alert alert-warning py-2 px-3 text-sm">
                              <Lock className="size-4" strokeWidth={1.75} />
                              হিসাবটি পরিবর্তিত হয়েছে। রেকর্ড ও ডিলিট বন্ধ।
                            </div>
                          ) : null}

                          {!running ? (
                            <div className="flex justify-between gap-3">
                              <span className="text-base-content/70">
                                তৈরির তারিখ
                              </span>
                              <span className="font-medium whitespace-nowrap">
                                {formatFullDate(
                                  detail.created_date || detail.created_at,
                                )}
                              </span>
                            </div>
                          ) : null}

                          <div className="flex justify-between gap-3">
                            <span className="text-base-content/70">
                              মোট হাজিরা
                            </span>
                            <span>{formatBnNumber(detail.present_days)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-base-content/70">মোট আয়</span>
                            <span className="text-success">
                              {formatBnSigned(
                                detail.total_earnings ??
                                  Number(detail.salary_earnings || 0) +
                                    Number(detail.extra_earnings || 0),
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-base-content/70">
                              মোট পেমেন্ট
                            </span>
                            <span className="text-error">
                              {formatBnSigned(
                                -Math.abs(detail.total_payment ?? 0),
                                { showPlus: false },
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-base-content/70">
                              মোট রিটার্ন
                            </span>
                            <span className="text-success">
                              {formatBnSigned(detail.total_return)}
                            </span>
                          </div>
                          <div className="border-t border-base-300 pt-2 flex justify-between gap-3 font-semibold">
                            <span>পাওনা</span>
                            <span
                              className={
                                Number(detail.payable) < 0
                                  ? 'text-error'
                                  : 'text-success'
                              }
                            >
                              {formatBnNumber(detail.payable ?? 0)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-base-content/70">
                              আগের পাওনা
                            </span>
                            <span
                              className={
                                Number(detail.previous_payable) < 0
                                  ? 'text-error'
                                  : 'text-success'
                              }
                            >
                              {formatBnSigned(detail.previous_payable ?? 0)}
                            </span>
                          </div>
                          <div className="border-t border-base-300 pt-2 flex justify-between gap-3 font-semibold">
                            <span>সর্বমোট পাওনা</span>
                            <span
                              className={
                                Number(detail.cumulative_payable) < 0
                                  ? 'text-error'
                                  : 'text-success'
                              }
                            >
                              {formatBnNumber(detail.cumulative_payable ?? 0)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-2 items-center pt-3">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm btn-secondary"
                              onClick={() =>
                                navigate(
                                  paths.labourSessionRecords(labourId, key),
                                )
                              }
                              disabled={locked}
                            >
                              বিস্তারিত দেখুন
                            </button>

                            {canDeleteSession && !running ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-error"
                                onClick={() => void onDeleteSession(itemSessionId)}
                                disabled={
                                  locked ||
                                  itemSessionId == null ||
                                  deleteSessionMutation.isPending
                                }
                              >
                                {deleteSessionMutation.isPending ? (
                                  <span className="loading loading-spinner loading-sm" />
                                ) : null}
                                ডিলিট করুন
                              </button>
                            ) : null}

                            {running && canCloseSession ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm ms-auto"
                                onClick={() => void onCloseSession()}
                                disabled={closeSessionMutation.isPending}
                              >
                                {closeSessionMutation.isPending ? (
                                  <span className="loading loading-spinner loading-sm" />
                                ) : null}
                                হিসাব ক্লোজ করুন
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <ListPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            isFetching={sessionsQuery.isFetching}
            onPageChange={onSessionsPageChange}
          />
        </section>
      ) : (
        <div className="text-sm text-base-content/60 py-4 text-center">
          হিসাব দেখার অনুমতি নেই।
        </div>
      )}

      <dialog
        ref={editDialogRef}
        id={EDIT_MODAL_ID}
        className="modal"
        onClose={onEditModalClose}
      >
        <div className="modal-box max-w-lg">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8">শ্রমিক আপডেট</h3>

          <ApiErrorAlert error={apiError} className="mb-3" />

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              return onConfirmEdit(e)
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">নাম</span>
              <input
                type="text"
                className={fieldClass(errors.name)}
                maxLength={255}
                {...register('name')}
              />
              {errors.name ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.name.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">বর্তমান সাইট</span>
              <select
                className={fieldClass(errors.current_site, 'select')}
                {...register('current_site')}
              >
                {showUnassignedOption ? (
                  <option value="">{NULL_SITE_LABEL}</option>
                ) : null}
                {siteOptions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.current_site ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.current_site.message}
                </span>
              ) : null}
            </label>

            <label className="label cursor-pointer justify-start gap-3 py-2">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                {...register('is_active')}
              />
              <span className="label-text">চালু</span>
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">ডিফল্ট হাজিরা</span>
              <select
                className={fieldClass(errors.default_attendance, 'select')}
                {...register('default_attendance')}
              >
                {DEFAULT_ATTENDANCE_OPTIONS.map((v) => (
                  <option key={v} value={String(v)}>
                    {formatBnNumber(v, { maximumFractionDigits: 1 })}
                  </option>
                ))}
              </select>
              {errors.default_attendance ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.default_attendance.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">ডিফল্ট বেতন</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className={fieldClass(errors.default_salary)}
                {...register('default_salary')}
              />
              {errors.default_salary ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.default_salary.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">ডিফল্ট খোরাকি</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className={fieldClass(errors.default_fooding)}
                {...register('default_fooding')}
              />
              {errors.default_fooding ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.default_fooding.message}
                </span>
              ) : null}
            </label>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={closeEditModal}
                disabled={busy}
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={saveDisabled}
              >
                {busy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                নিশ্চিত
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  )
}
