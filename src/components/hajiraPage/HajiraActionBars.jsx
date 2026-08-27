import { formatBnNumber } from "../../utils/format.js";

export function HajiraActionBars({
  hasPendingCreates,
  onCancel,
  saving,
  onSave,
  rows,
  selectMode,
  canChangeActivityLog,
  reviewing,
  exitSelectMode,
  selectedIds,
  onAcceptChanges,
}) {
  return (
    <>
      {hasPendingCreates ? (
        <div className="fixed bottom-16 right-4 z-40 flex items-center gap-2">
          <button
            type="button"
            className="btn shadow-lg border border-base-300 bg-base-100"
            onClick={onCancel}
            disabled={saving}
          >
            বাতিল
          </button>
          <button
            type="button"
            className="btn btn-primary shadow-lg"
            onClick={onSave}
            disabled={saving || rows.length === 0}
          >
            {saving ? (
              <span className="loading loading-spinner loading-sm" />
            ) : null}
            নিশ্চিত
          </button>
        </div>
      ) : selectMode && canChangeActivityLog ? (
        <div className="fixed bottom-16 inset-x-0 z-40 px-3 pointer-events-none">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-end gap-2 pointer-events-auto">
            <button
              type="button"
              className="btn shadow-lg border border-base-300 bg-base-100"
              disabled={reviewing}
              onClick={exitSelectMode}
            >
              বাতিল
            </button>
            <button
              type="button"
              className="btn btn-primary shadow-lg"
              disabled={reviewing || selectedIds.size === 0}
              onClick={onAcceptChanges}
            >
              {reviewing ? (
                <span className="loading loading-spinner loading-sm" />
              ) : null}
              অডিট করুন
              {selectedIds.size > 0 ? (
                <span className="badge badge-sm badge-ghost">
                  {formatBnNumber(selectedIds.size)}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
