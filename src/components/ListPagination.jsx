import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatBnNumber } from '../utils/format.js'

/** Prev / page / next bar — matches ActivityPage list chrome. */
export const ListPagination = ({
  page,
  totalPages,
  totalCount,
  pageSize,
  isFetching = false,
  onPageChange,
}) => {
  if (!(totalCount > pageSize)) return null
  return (
    <div className="shrink-0 flex items-center justify-between gap-2 px-2 py-2 border-t border-base-300 bg-base-100">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={page <= 1 || isFetching}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <ChevronLeft className="size-4" strokeWidth={2} />
        পূর্ববর্তী
      </button>
      <span className="text-sm tabular-nums text-base-content/70">
        {formatBnNumber(page)} / {formatBnNumber(totalPages)}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={page >= totalPages || isFetching}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        পরবর্তী
        <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </div>
  )
}
