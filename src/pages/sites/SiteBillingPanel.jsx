import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createBillingCategory,
  deleteBillingCategory,
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
import { useBillingLookup } from '../../hooks/useBillingLookup.js'
import { usePermissions } from '../../hooks/usePermissions.js'
import { formatBnNumber } from '../../utils/format.js'
import { confirmAction, toastSuccess } from '../../utils/feedback.js'
import { PERMS } from '../../utils/permissions.js'

const BILLING_MODAL_ID = 'site_billing_category_modal'

const emptyBillingValues = {
  name: '',
  display_order: 0,
  is_active: true,
  is_done: false,
}

const toBillingFormValues = (row) => ({
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
        canReorder
          ? 'cursor-grab active:cursor-grabbing touch-none'
          : 'cursor-pointer',
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

export const SiteBillingPanel = ({ siteId, showFab = true }) => {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const billingDialogRef = useRef(null)

  const [billingApiError, setBillingApiError] = useState(null)
  const [listError, setListError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [editingBilling, setEditingBilling] = useState(false)
  const [confirmReady, setConfirmReady] = useState(false)
  const [rows, setRows] = useState([])
  const [reordering, setReordering] = useState(false)
  const skipOpenRef = useRef(false)

  const canViewBillingCategory = can(PERMS.viewBillingCategory)
  const canAddBillingCategory = can(PERMS.addBillingCategory)
  const canChangeBillingCategory = can(PERMS.changeBillingCategory)
  const canDeleteBillingCategory = can(PERMS.deleteBillingCategory)

  const isCreateMode = creating
  const isDetailMode = Boolean(selected) && !creating

  const {
    register: registerBilling,
    handleSubmit: handleSubmitBilling,
    reset: resetBilling,
    setError: setBillingError,
    setValue: setBillingValue,
    watch: watchBilling,
    formState: { errors: billingErrors, isSubmitting: billingIsSubmitting },
  } = useForm({
    resolver: zodResolver(billingCategoryFormSchema),
    defaultValues: emptyBillingValues,
  })

  const isDoneValue = watchBilling('is_done')
  const isActiveValue = watchBilling('is_active')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const billingLookup = useBillingLookup(siteId, {
    enabled: Boolean(canViewBillingCategory && siteId),
  })
  const billingQuery = billingLookup

  const saveBillingMutation = useMutation({
    mutationFn: (values) => {
      const payload = toBillingCategoryPayload(values)
      if (isCreateMode) return createBillingCategory(siteId, payload)
      return updateBillingCategory(siteId, selected.id, payload)
    },
  })

  const deleteBillingMutation = useMutation({
    mutationFn: () => deleteBillingCategory(siteId, selected.id),
  })

  useEffect(() => {
    if (billingLookup.categories) setRows(sortByOrder(billingLookup.categories))
  }, [billingLookup.categories])

  useEffect(() => {
    if (!editingBilling && !creating) {
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
  }, [editingBilling, creating])

  const resetBillingModalState = () => {
    setSelected(null)
    setCreating(false)
    setEditingBilling(false)
    setBillingApiError(null)
    resetBilling(emptyBillingValues)
  }

  const closeBillingModal = () => {
    billingDialogRef.current?.close()
  }

  const openCreateBilling = () => {
    setBillingApiError(null)
    setSelected(null)
    setCreating(true)
    setEditingBilling(true)
    setConfirmReady(false)
    resetBilling({
      ...emptyBillingValues,
      display_order: rows.length,
    })
    billingDialogRef.current?.showModal()
  }

  const openBillingDetail = (row) => {
    if (skipOpenRef.current) {
      skipOpenRef.current = false
      return
    }
    setBillingApiError(null)
    setCreating(false)
    setEditingBilling(false)
    setConfirmReady(false)
    setSelected(row)
    resetBilling(toBillingFormValues(row))
    billingDialogRef.current?.showModal()
  }

  const startBillingEdit = () => {
    setBillingApiError(null)
    setConfirmReady(false)
    setEditingBilling(true)
  }

  const cancelBillingEdit = () => {
    if (isCreateMode) {
      closeBillingModal()
      return
    }
    setBillingApiError(null)
    resetBilling(toBillingFormValues(selected))
    setEditingBilling(false)
  }

  const onConfirmBilling = handleSubmitBilling(async (values) => {
    setBillingApiError(null)
    try {
      const { data } = await saveBillingMutation.mutateAsync(values)
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'billing-categories'],
      })
      if (isCreateMode) {
        closeBillingModal()
        toastSuccess('বিলিং ক্যাটাগরি তৈরি হয়েছে')
      } else {
        setSelected(data)
        resetBilling(toBillingFormValues(data))
        setEditingBilling(false)
        toastSuccess('বিলিং ক্যাটাগরি আপডেট হয়েছে')
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setBillingApiError(parsed)
      applyFieldErrors(parsed, setBillingError)
    }
  })

  const onDeleteBilling = async () => {
    const ok = await confirmAction({
      title: 'বিলিং ক্যাটাগরি মুছে ফেলবেন?',
      text: 'এই কাজটি ফিরিয়ে আনা যাবে না।',
      confirmText: 'ডিলিট করুন',
      danger: true,
    })
    if (!ok) return
    setBillingApiError(null)
    try {
      await deleteBillingMutation.mutateAsync()
      await queryClient.invalidateQueries({
        queryKey: ['sites', siteId, 'billing-categories'],
      })
      closeBillingModal()
      toastSuccess('বিলিং ক্যাটাগরি ডিলিট হয়েছে')
    } catch (err) {
      setBillingApiError(parseApiError(err))
    }
  }

  const onDragStart = () => {
    skipOpenRef.current = true
  }

  const onDragEnd = async (event) => {
    const { active, over } = event

    window.setTimeout(() => {
      skipOpenRef.current = false
    }, 80)

    if (!over || active.id === over.id || !canChangeBillingCategory) return

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
      toastSuccess('ক্রম আপডেট হয়েছে')
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

  if (!canViewBillingCategory) {
    return (
      <p className="text-sm text-base-content/60 py-2">
        বিলিং ক্যাটাগরি দেখার অনুমতি নেই।
      </p>
    )
  }

  if (billingQuery.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    )
  }

  if (billingQuery.isError) {
    return <ApiErrorAlert error={parseApiError(billingQuery.error)} />
  }

  const billingDisabled = !editingBilling
  const billingBusy = billingIsSubmitting || saveBillingMutation.isPending
  const billingFieldClass = (hasError) =>
    [
      'input input-bordered w-full',
      hasError ? 'input-error' : '',
      billingDisabled ? 'bg-base-100' : '',
    ].join(' ')

  const canReorder =
    canChangeBillingCategory && rows.length > 1 && !reordering

  return (
    <div className="relative pb-4">
      <ApiErrorAlert error={listError} />

      {reordering ? (
        <div className="flex items-center gap-2 text-xs text-base-content/60 px-1 mb-2">
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
                      onOpen={openBillingDetail}
                    />
                  ))
                )}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {showFab && canAddBillingCategory ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-4 right-4 z-40 shadow-lg"
          aria-label="নতুন বিলিং ক্যাটাগরি"
          onClick={openCreateBilling}
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>
      ) : null}

      <dialog
        ref={billingDialogRef}
        id={BILLING_MODAL_ID}
        className="modal"
        onClose={resetBillingModalState}
      >
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
            {isCreateMode
              ? 'নতুন বিলিং ক্যাটাগরি'
              : selected?.name || 'বিলিং ক্যাটাগরি'}
          </h3>

          <ApiErrorAlert error={billingApiError} className="mb-3 shrink-0" />

          <form
            className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault()
              if (!confirmReady) return
              return onConfirmBilling(e)
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">নাম</span>
              <input
                type="text"
                className={billingFieldClass(billingErrors.name)}
                maxLength={255}
                disabled={billingDisabled}
                {...registerBilling('name')}
              />
              {billingErrors.name ? (
                <span className="label-text-alt text-error mt-1">
                  {billingErrors.name.message}
                </span>
              ) : null}
            </label>

            <label
              className={[
                'label justify-start gap-3 py-1',
                billingDisabled || isDoneValue
                  ? 'cursor-default'
                  : 'cursor-pointer',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                disabled={billingDisabled || Boolean(isDoneValue)}
                checked={isDoneValue ? false : Boolean(isActiveValue)}
                onChange={(e) => {
                  if (billingDisabled || isDoneValue) return
                  setBillingValue('is_active', e.target.checked, {
                    shouldDirty: true,
                  })
                }}
              />
              <span className="label-text">চালু</span>
            </label>

            {!isCreateMode ? (
              <label
                className={[
                  'label justify-start gap-3 py-1',
                  billingDisabled ? 'cursor-default' : 'cursor-pointer',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="toggle toggle-info toggle-sm"
                  disabled={billingDisabled}
                  checked={Boolean(isDoneValue)}
                  onChange={(e) => {
                    if (billingDisabled) return
                    const done = e.target.checked
                    setBillingValue('is_done', done, { shouldDirty: true })
                    if (done) {
                      setBillingValue('is_active', false, { shouldDirty: true })
                    }
                  }}
                />
                <span className="label-text">সম্পন্ন</span>
              </label>
            ) : null}

            {editingBilling ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1"
                  onClick={cancelBillingEdit}
                  disabled={billingBusy}
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={!confirmReady || billingBusy}
                  onClick={(e) => {
                    if (!confirmReady) return
                    return onConfirmBilling(e)
                  }}
                >
                  {billingBusy ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  নিশ্চিত
                </button>
              </div>
            ) : isDetailMode ? (
              <div className="modal-action mt-2 justify-stretch gap-2">
                {canDeleteBillingCategory ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-error flex-1"
                    onClick={onDeleteBilling}
                    disabled={deleteBillingMutation.isPending}
                  >
                    {deleteBillingMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    )}
                    ডিলিট
                  </button>
                ) : null}
                {canChangeBillingCategory ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-primary flex-1"
                    onClick={startBillingEdit}
                  >
                    <Pencil className="size-4" strokeWidth={1.75} />
                    আপডেট
                  </button>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>
    </div>
  )
}
