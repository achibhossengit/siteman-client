import { useEffect, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

const sortByOrder = (rows) =>
  [...(rows ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  )

const withSequentialOrder = (rows) =>
  rows.map((row, index) => ({ ...row, display_order: index }))

const SortableBillingRow = ({ row, index, canReorder, onOpen }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    disabled: !canReorder,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : undefined,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={[
        'border-b border-base-300/70 hover:bg-base-200/60',
        canReorder ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer',
        isDragging ? 'bg-base-200 shadow-md' : '',
      ].join(' ')}
      onClick={() => onOpen(row)}
      {...(canReorder ? { ...attributes, ...listeners } : {})}
    >
      <td className="tabular-nums text-base-content/60 w-12">
        {formatBnNumber(index + 1)}
      </td>
      <td className="font-medium">
        <div className="truncate max-w-40 sm:max-w-none">{row.name}</div>
      </td>
      <td className="text-right">
        <span className={`badge badge-sm ${billingStatusClass(row)}`}>
          {billingStatusLabel(row)}
        </span>
      </td>
    </tr>
  )
}

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
  const [listError, setListError] = useState(null)
  const [rows, setRows] = useState([])
  const [reordering, setReordering] = useState(false)
  const skipOpenRef = useRef(false)

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
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(billingCategoryFormSchema),
    defaultValues: emptyValues,
  })

  const isDoneValue = watch('is_done')
  const isActiveValue = watch('is_active')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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
      return sortByOrder(Array.isArray(data) ? data : [])
    },
    enabled: Boolean(canView && siteId),
  })

  const siteName = siteQuery.data?.name

  useEffect(() => {
    if (listQuery.data) setRows(listQuery.data)
  }, [listQuery.data])

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
    reset({
      ...emptyValues,
      display_order: rows.length,
    })
    dialogRef.current?.showModal()
  }

  const openDetail = (row) => {
    if (skipOpenRef.current) {
      skipOpenRef.current = false
      return
    }
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

  const onDragStart = () => {
    skipOpenRef.current = true
  }

  const onDragEnd = async (event) => {
    const { active, over } = event

    // Ignore the click that often follows a drag release.
    window.setTimeout(() => {
      skipOpenRef.current = false
    }, 80)

    if (!over || active.id === over.id || !canChange) return

    const oldIndex = rows.findIndex((r) => r.id === active.id)
    const newIndex = rows.findIndex((r) => r.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const previous = rows
    const next = withSequentialOrder(arrayMove(rows, oldIndex, newIndex))
    setRows(next)
    setListError(null)
    setReordering(true)

    const prevById = new Map(previous.map((r) => [r.id, r]))
    const toPatch = next.filter((row) => {
      const prev = prevById.get(row.id)
      return prev && prev.display_order !== row.display_order
    })

    try {
      await Promise.all(
        toPatch.map((row) =>
          updateBillingCategory(siteId, row.id, {
            display_order: row.display_order,
          }),
        ),
      )
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'billing-categories'],
      })
    } catch (err) {
      setRows(previous)
      setListError(parseApiError(err))
    } finally {
      setReordering(false)
    }
  }

  const onDragCancel = () => {
    window.setTimeout(() => {
      skipOpenRef.current = false
    }, 80)
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

  const disabled = !editing
  const busy = isSubmitting || saveMutation.isPending
  const fieldClass = (hasError) =>
    [
      'input input-bordered w-full',
      hasError ? 'input-error' : '',
      disabled ? 'bg-base-100' : '',
    ].join(' ')

  const canReorder = canChange && rows.length > 1 && !reordering

  return (
    <section className="relative min-h-full flex flex-col pb-20">
      <ApiErrorAlert error={listError} className="mb-3" />

      {reordering ? (
        <div className="flex items-center gap-2 text-xs text-base-content/60 mb-2 px-1">
          <span className="loading loading-spinner loading-xs" />
          ক্রম আপডেট হচ্ছে…
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <table className="table table-sm sm:table-md w-full">
            <thead>
              <tr className="border-b border-base-300">
                <th className="w-12">নং</th>
                <th>নাম</th>
                <th className="w-28 text-right">স্ট্যাটাস</th>
              </tr>
            </thead>
            <SortableContext
              items={rows.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-center text-sm text-base-content/60 py-10"
                    >
                      কোনো বিলিং ক্যাটাগরি নেই।
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <SortableBillingRow
                      key={row.id}
                      row={row}
                      index={index}
                      canReorder={canReorder}
                      onOpen={openDetail}
                    />
                  ))
                )}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
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

            <label
              className={[
                'label justify-start gap-3 py-1',
                disabled || isDoneValue
                  ? 'cursor-default'
                  : 'cursor-pointer',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                disabled={disabled || Boolean(isDoneValue)}
                checked={Boolean(isDoneValue) ? false : Boolean(isActiveValue)}
                onChange={(e) => {
                  if (disabled || isDoneValue) return
                  setValue('is_active', e.target.checked, { shouldDirty: true })
                }}
              />
              <span className="label-text">সক্রিয়</span>
            </label>

            <label
              className={[
                'label justify-start gap-3 py-1',
                disabled ? 'cursor-default' : 'cursor-pointer',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="toggle toggle-info toggle-sm"
                disabled={disabled}
                checked={Boolean(isDoneValue)}
                onChange={(e) => {
                  if (disabled) return
                  const done = e.target.checked
                  setValue('is_done', done, { shouldDirty: true })
                  if (done) {
                    setValue('is_active', false, { shouldDirty: true })
                  }
                }}
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
