import { useEffect, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createBillingCategory,
  deleteBillingCategory,
  fetchBillingCategories,
  fetchSiteDetail,
  updateBillingCategory,
} from '../../api/sites.js'
import {
  billingCategoryFormSchema,
  billingStatusClass,
  billingStatusLabel,
  toBillingCategoryPayload,
} from '../../api/types/billingCategory.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { PERMS } from '../../utils/permissions.js'

const MODAL_ID = 'site_billing_category_modal'

const emptyValues = {
  name: '',
  display_order: 0,
  is_active: true,
  is_done: false,
}

const toFormValues = (row) => ({
  name: row?.name ?? '',
  display_order: row?.display_order ?? 0,
  is_active: row?.is_active ?? true,
  is_done: row?.is_done ?? false,
})

export const SiteBillingPage = () => {
  const { siteId } = useParams()
  const { setTitle, setHeaderMenu } = useOutletContext()
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const dialogRef = useRef(null)

  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmReady, setConfirmReady] = useState(false)
  const [apiError, setApiError] = useState(null)

  const canView = can(PERMS.viewBillingCategory)
  const canAdd = can(PERMS.addBillingCategory)
  const canChange = can(PERMS.changeBillingCategory)
  const canDelete = can(PERMS.deleteBillingCategory)

  const isCreateMode = creating
  const isDetailMode = Boolean(selected) && !creating

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(billingCategoryFormSchema),
    defaultValues: emptyValues,
  })

  const siteQuery = useQuery({
    queryKey: ['sites', siteId],
    queryFn: async () => {
      const { data } = await fetchSiteDetail(siteId)
      return data
    },
    enabled: Boolean(canView && siteId),
  })

  const listQuery = useQuery({
    queryKey: ['sites', siteId, 'billing-categories'],
    queryFn: async () => {
      const { data } = await fetchBillingCategories(siteId)
      const rows = Array.isArray(data) ? data : []
      return [...rows].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
      )
    },
    enabled: Boolean(canView && siteId),
  })

  const siteName = siteQuery.data?.name

  useEffect(() => {
    setTitle?.('বিলিং ক্যাটাগরি')
    return () => setTitle?.('')
  }, [setTitle])

  useEffect(() => {
    setHeaderMenu?.(
      siteName ? (
        <span className="text-sm font-medium text-base-content/80 truncate px-1 max-w-full">
          {siteName}
        </span>
      ) : null,
    )
    return () => setHeaderMenu?.(null)
  }, [siteName, setHeaderMenu])

  useEffect(() => {
    if (!editing && !creating) {
      setConfirmReady(false)
      return
    }
    let cancelled = false
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setConfirmReady(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [editing, creating])

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = toBillingCategoryPayload(values)
      if (isCreateMode) return createBillingCategory(siteId, payload)
      return updateBillingCategory(siteId, selected.id, payload)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBillingCategory(siteId, selected.id),
  })

  const resetModalState = () => {
    setSelected(null)
    setCreating(false)
    setEditing(false)
    setApiError(null)
    reset(emptyValues)
  }

  const closeModal = () => {
    dialogRef.current?.close()
  }

  const openCreate = () => {
    setApiError(null)
    setSelected(null)
    setCreating(true)
    setEditing(true)
    setConfirmReady(false)
    reset(emptyValues)
    dialogRef.current?.showModal()
  }

  const openDetail = (row) => {
    setApiError(null)
    setCreating(false)
    setEditing(false)
    setConfirmReady(false)
    setSelected(row)
    reset(toFormValues(row))
    dialogRef.current?.showModal()
  }

  const startEdit = () => {
    setApiError(null)
    setConfirmReady(false)
    setEditing(true)
  }

  const cancelEdit = () => {
    if (isCreateMode) {
      closeModal()
      return
    }
    setApiError(null)
    reset(toFormValues(selected))
    setEditing(false)
  }

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null)
    try {
      const { data } = await saveMutation.mutateAsync(values)
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'billing-categories'],
      })
      if (isCreateMode) {
        closeModal()
      } else {
        setSelected(data)
        reset(toFormValues(data))
        setEditing(false)
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  })

  const onDelete = async () => {
    const ok = window.confirm('এই বিলিং ক্যাটাগরি মুছে ফেলতে চান?')
    if (!ok) return
    setApiError(null)
    try {
      await deleteMutation.mutateAsync()
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'billing-categories'],
      })
      closeModal()
    } catch (err) {
      setApiError(parseApiError(err))
    }
  }

  if (!canView) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    )
  }

  if (listQuery.isLoading || siteQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (listQuery.isError) {
    return <ApiErrorAlert error={parseApiError(listQuery.error)} />
  }

  if (siteQuery.isError) {
    return <ApiErrorAlert error={parseApiError(siteQuery.error)} />
  }

  const rows = listQuery.data ?? []
  const disabled = !editing
  const busy = isSubmitting || saveMutation.isPending
  const fieldClass = (hasError) =>
    [
      'input input-bordered w-full',
      hasError ? 'input-error' : '',
      disabled ? 'bg-base-100' : '',
    ].join(' ')

  return (
    <section className="relative min-h-full flex flex-col pb-20">
      <div className="overflow-x-auto">
        <table className="table table-sm sm:table-md w-full">
          <thead>
            <tr className="border-b border-base-300">
              <th className="w-12">নং</th>
              <th>নাম</th>
              <th className="w-16 text-center hidden sm:table-cell">ক্রম</th>
              <th className="w-28 text-right">স্ট্যাটাস</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  কোনো বিলিং ক্যাটাগরি নেই।
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-base-300/70 cursor-pointer hover:bg-base-200/60"
                  onClick={() => openDetail(row)}
                >
                  <td className="tabular-nums text-base-content/60">
                    {formatBnNumber(index + 1)}
                  </td>
                  <td className="font-medium">
                    <div className="truncate max-w-40 sm:max-w-none">
                      {row.name}
                    </div>
                    <div className="sm:hidden text-xs text-base-content/60 tabular-nums">
                      ক্রম {formatBnNumber(row.display_order ?? 0)}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell text-center tabular-nums text-sm text-base-content/80">
                    {formatBnNumber(row.display_order ?? 0)}
                  </td>
                  <td className="text-right">
                    <span
                      className={`badge badge-sm ${billingStatusClass(row)}`}
                    >
                      {billingStatusLabel(row)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canAdd ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-4 right-4 z-40 shadow-lg"
          aria-label="নতুন বিলিং ক্যাটাগরি"
          onClick={openCreate}
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>
      ) : null}

      <dialog
        ref={dialogRef}
        id={MODAL_ID}
        className="modal"
        onClose={resetModalState}
      >
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8">
            {isCreateMode
              ? 'নতুন বিলিং ক্যাটাগরি'
              : selected?.name || 'বিলিং ক্যাটাগরি'}
          </h3>

          <ApiErrorAlert error={apiError} className="mb-3" />

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!confirmReady) return
              return onConfirm(e)
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">নাম</span>
              <input
                type="text"
                className={fieldClass(errors.name)}
                maxLength={255}
                disabled={disabled}
                {...register('name')}
              />
              {errors.name ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.name.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">ক্রম</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                className={fieldClass(errors.display_order)}
                disabled={disabled}
                {...register('display_order')}
              />
              {errors.display_order ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.display_order.message}
                </span>
              ) : null}
            </label>

            <label className="label cursor-pointer justify-start gap-3 py-1">
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                disabled={disabled}
                {...register('is_active')}
              />
              <span className="label-text">সক্রিয়</span>
            </label>

            <label className="label cursor-pointer justify-start gap-3 py-1">
              <input
                type="checkbox"
                className="toggle toggle-info toggle-sm"
                disabled={disabled}
                {...register('is_done')}
              />
              <span className="label-text">সম্পন্ন</span>
            </label>

            {editing ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1"
                  onClick={cancelEdit}
                  disabled={busy}
                >
                  <X className="size-4" strokeWidth={1.75} />
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={!confirmReady || busy}
                  onClick={(e) => {
                    if (!confirmReady) return
                    return onConfirm(e)
                  }}
                >
                  {busy ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <Check className="size-4" strokeWidth={2} />
                  )}
                  নিশ্চিত করুন
                </button>
              </div>
            ) : isDetailMode ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                {canDelete ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-error flex-1"
                    onClick={onDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    )}
                    ডিলিট
                  </button>
                ) : null}
                {canChange ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-primary flex-1"
                    onClick={startEdit}
                  >
                    <Pencil className="size-4" strokeWidth={1.75} />
                    আপডেট
                  </button>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </section>
  )
}
