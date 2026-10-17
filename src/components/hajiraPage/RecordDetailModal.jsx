import { Link } from "react-router-dom";
import { Pencil, Trash2, X } from "lucide-react";
import { PRESENT_OPTIONS, sessionOnDate } from "../../api/types/hajira.js";
import { messageForCode } from "../../api/errors.js";
import {
  DailyRecordHistoryPanel,
  RECORD_LOG_FIELD_LABELS,
  summarizeDailyRecordLog,
} from "../DailyRecordHistoryPanel.jsx";
import { SHOW_BILLING } from "../../config/features.js";
import {
  formatBnNumber,
  formatBnSigned,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import { paths } from "../../router/paths.js";
import { formatDateBn, parseIsoDate, toIsoDate, todayIso } from "../../utils/dateRange.js";
import {
  MEANINGFUL_DAY_VALUE_MESSAGE,
  MODAL_VIEWS,
  RECORD_MODAL_ID,
} from "./constants.js";
import {
  displayModalValue,
  hasMeaningfulDayValue,
  hasPresent,
  isCreateBlockedByLastSession,
  lastSessionCreateBlockedMessage,
  numOrEmpty,
  recordIdOf,
  recordSealedOf,
} from "./helpers.js";

const formatSessionDay = (iso) => {
  const d = parseIsoDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
};

const sessionPeriodLabel = (start, end) => {
  const from = formatSessionDay(start);
  const to = formatSessionDay(end);
  if (from && to) return `${from} – ${to}`;
  return from || to;
};

const sessionLinkOf = (modal) => {
  if (!modal?.labourId) return null;
  const matched = sessionOnDate(modal.sessions, modal.date);
  if (matched?.id != null) {
    return {
      labourId: modal.labourId,
      sessionId: String(matched.id),
      settlement: matched.settlement ?? modal.settlement ?? 0,
      period: sessionPeriodLabel(matched.start_date, matched.end_date),
    };
  }
  if (!modal.hasSession) return null;
  return {
    labourId: modal.labourId,
    sessionId: "latest",
    settlement: modal.settlement ?? 0,
    period: sessionPeriodLabel(null, modal.lastSessionDate),
  };
};

const minDateAfterLastSession = (lastSessionDate) => {
  const d = parseIsoDate(lastSessionDate);
  if (!d) return undefined;
  d.setDate(d.getDate() + 1);
  return toIsoDate(d);
};

export function RecordDetailModal({
  recordModal,
  setRecordModal,
  recordModalView,
  setRecordModalView,
  canViewActivityLog,
  canShowRecordHistory,
  modalEditing,
  modalDeleting,
  resetModalEditState,
  setExpandedHistoryId,
  historyIsLoading,
  historyError,
  recordHistoryLogs,
  expandedHistoryId,
  billingFullLabel,
  modalEditable,
  rows,
  patchRecordModal,
  recordModalLocked,
  salaryFieldEnabled,
  billingFieldEnabled,
  billingOptions,
  isCreateModal,
  resetRecordModal,
  applyRecordModalDefaults,
  saveRecordModal,
  recordModalCanSet,
  recordModalDirty,
  createFormSelected,
  cancelModalEdit,
  modalSaving,
  confirmModalUpdate,
  billingFullLabelForRow,
  canDeleteRecord,
  cancelModalDelete,
  confirmModalDelete,
  canDeleteDailyRecord,
  startModalDelete,
  canUpdateRecord,
  canChangeDailyRecord,
  startModalEdit,
  date,
}) {
  const sessionLink = sessionLinkOf(recordModal);
  return (
      <dialog
        id={RECORD_MODAL_ID}
        className="modal"
        onClose={() => {
          setRecordModal(null);
          setRecordModalView(MODAL_VIEWS.detail);
          setExpandedHistoryId(null);
          resetModalEditState();
        }}
      >
        <div className="modal-box max-w-sm p-4 max-h-[min(32rem,85vh)] flex flex-col overflow-hidden!">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>

          <h3 className="font-semibold text-base mb-2 pr-8 shrink-0">
            {recordModal &&
            canViewActivityLog &&
            canShowRecordHistory &&
            !modalEditing &&
            !modalDeleting ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={
                    recordModalView === MODAL_VIEWS.detail
                      ? "text-primary"
                      : "text-base-content/50 hover:text-base-content"
                  }
                  onClick={() => {
                    setRecordModalView(MODAL_VIEWS.detail);
                    setExpandedHistoryId(null);
                  }}
                >
                  বিস্তারিত
                </button>
                <button
                  type="button"
                  className={
                    recordModalView === MODAL_VIEWS.history
                      ? "text-primary"
                      : "text-base-content/50 hover:text-base-content"
                  }
                  onClick={() => {
                    setRecordModalView(MODAL_VIEWS.history);
                    setExpandedHistoryId(null);
                  }}
                >
                  অডিট হিস্ট্রি
                </button>
              </div>
            ) : recordModal ? (
              `হাজিরা (${recordModal.labourName})`
            ) : (
              "হাজিরা"
            )}
          </h3>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {recordModal &&
            recordModalView === MODAL_VIEWS.history &&
            canShowRecordHistory &&
            !modalEditing &&
            !modalDeleting ? (
              <DailyRecordHistoryPanel
                isLoading={historyIsLoading}
                error={historyError}
                logs={recordHistoryLogs}
                expandedId={expandedHistoryId}
                setExpandedId={setExpandedHistoryId}
                fieldLabels={RECORD_LOG_FIELD_LABELS}
                billingNameFn={billingFullLabel}
                summarize={summarizeDailyRecordLog}
              />
            ) : recordModal ? (
              <div className="flex flex-col gap-2">
                {modalEditable ? (
                  <>
                    <label className="form-control w-full">
                      <span className="label-text mb-1">তারিখ</span>
                      <input
                        type="date"
                        className="input input-bordered input-sm w-full"
                        value={recordModal.date || date || ""}
                        min={minDateAfterLastSession(
                          recordModal.lastSessionDate,
                        )}
                        max={todayIso()}
                        disabled={recordModalLocked || isCreateModal}
                        onChange={(e) =>
                          patchRecordModal({ date: e.target.value })
                        }
                      />
                    </label>

                    {isCreateModal &&
                    isCreateBlockedByLastSession(
                      recordModal,
                      recordModal.date || date,
                    ) ? (
                      <p className="text-sm text-center text-warning bg-warning/10 rounded-md px-3 py-2">
                        {lastSessionCreateBlockedMessage(recordModal)}
                      </p>
                    ) : null}

                    <div className="grid grid-cols-3 gap-2">
                      <label className="form-control w-full min-w-0 overflow-hidden">
                        <span className="label-text mb-1">হাজিরা</span>
                        <select
                          className="select select-bordered select-sm w-full min-w-0 max-w-full"
                          value={
                            recordModal.present === "" ||
                            recordModal.present == null
                              ? "0"
                              : String(recordModal.present)
                          }
                          disabled={recordModalLocked}
                          onChange={(e) => {
                            const present = e.target.value;
                            const row = rows.find(
                              (r) => r.labourId === recordModal.labourId,
                            );
                            const presentNum = Number(present);
                            if (presentNum === 0) {
                              patchRecordModal({ present, salary: "" });
                              return;
                            }
                            const fillingFromZeroOrEmpty =
                              !hasPresent(recordModal) ||
                              Number(recordModal.present) === 0;
                            patchRecordModal({
                              present,
                              ...(fillingFromZeroOrEmpty
                                ? {
                                    salary: numOrEmpty(row?.defaultSalary),
                                  }
                                : {}),
                            });
                          }}
                        >
                          {PRESENT_OPTIONS.map((v) => (
                            <option key={v} value={String(v)}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="form-control w-full min-w-0">
                        <span className="label-text mb-1">বেতন</span>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-full min-w-0 tabular-nums"
                          value={recordModal.salary}
                          disabled={!salaryFieldEnabled}
                          onChange={(e) =>
                            patchRecordModal({
                              salary: numOrEmpty(e.target.value),
                            })
                          }
                        />
                      </label>

                      <label className="form-control w-full min-w-0">
                        <span className="label-text mb-1">খোরাকি</span>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-full min-w-0 tabular-nums"
                          value={recordModal.payment}
                          disabled={recordModalLocked}
                          onChange={(e) =>
                            patchRecordModal({
                              payment: numOrEmpty(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-dashed border-base-300 opacity-50 hover:opacity-85 focus-within:opacity-100 transition-opacity [&_.label-text]:text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <label className="form-control w-full min-w-0">
                          <span className="label-text mb-1">বাড়তি কাজ</span>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full min-w-0 tabular-nums"
                            value={recordModal.extra}
                            disabled={recordModalLocked}
                            onChange={(e) =>
                              patchRecordModal({
                                extra: numOrEmpty(e.target.value),
                              })
                            }
                          />
                        </label>

                        <label className="form-control w-full min-w-0">
                          <span className="label-text mb-1">অ্যাডভান্স</span>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full min-w-0 tabular-nums"
                            value={recordModal.advance}
                            disabled={recordModalLocked}
                            onChange={(e) =>
                              patchRecordModal({
                                advance: numOrEmpty(e.target.value),
                              })
                            }
                          />
                        </label>

                        <label className="form-control w-full min-w-0">
                          <span className="label-text mb-1">রিটার্ন</span>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full min-w-0 tabular-nums"
                            value={recordModal.return}
                            disabled={recordModalLocked}
                            onChange={(e) =>
                              patchRecordModal({
                                return: numOrEmpty(e.target.value),
                              })
                            }
                          />
                        </label>
                      </div>

                      <label className="form-control w-full">
                        <span className="label-text mb-1">নোট</span>
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full"
                          value={recordModal.note}
                          disabled={
                            recordModalLocked ||
                            !hasMeaningfulDayValue(recordModal)
                          }
                          onChange={(e) =>
                            setRecordModal((m) => ({
                              ...m,
                              note: e.target.value,
                            }))
                          }
                          maxLength={255}
                        />
                      </label>
                    </div>

                    {SHOW_BILLING ? (
                      <label className="form-control w-full">
                        <span className="label-text mb-1">বিলিং</span>
                        <select
                          className="select select-bordered select-sm w-full"
                          value={
                            recordModal.billing == null ||
                            recordModal.billing === ""
                              ? ""
                              : String(recordModal.billing)
                          }
                          disabled={!billingFieldEnabled}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            const opt = billingOptions.find(
                              (b) => String(b.id) === String(nextId),
                            );
                            patchRecordModal({
                              billing: nextId,
                              billingName:
                                nextId === ""
                                  ? null
                                  : (opt?.name ??
                                    recordModal.billingName ??
                                    null),
                            });
                          }}
                        >
                          <option value="">{NULL_BILLING_LABEL}</option>
                          {(() => {
                            const opts = [...billingOptions];
                            const cur = recordModal.billing;
                            if (
                              cur !== "" &&
                              cur != null &&
                              !opts.some((b) => String(b.id) === String(cur))
                            ) {
                              opts.unshift({
                                id: cur,
                                name:
                                  recordModal.billingName ||
                                  billingFullLabel(cur),
                              });
                            }
                            return opts.map((b) => (
                              <option key={b.id} value={String(b.id)}>
                                {b.name}
                              </option>
                            ));
                          })()}
                        </select>
                      </label>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="form-control w-full">
                      <span className="label-text mb-0.5">তারিখ</span>
                      <div className="min-h-6 flex items-center px-1 text-sm">
                        {recordModal.date
                          ? formatDateBn(String(recordModal.date))
                          : "—"}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="form-control w-full min-w-0">
                        <span className="label-text mb-0.5">হাজিরা</span>
                        <div className="min-h-6 flex items-center px-1 text-sm tabular-nums">
                          {recordModal.present === ""
                            ? "—"
                            : formatBnNumber(recordModal.present)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text mb-0.5">বেতন</span>
                        <div className="min-h-6 flex items-center px-1 text-sm tabular-nums">
                          {displayModalValue(recordModal.salary)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text mb-0.5">খোরাকি</span>
                        <div className="min-h-6 flex items-center px-1 text-sm tabular-nums">
                          {displayModalValue(recordModal.payment)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-dashed border-base-300 opacity-50 [&_.label-text]:text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="form-control w-full min-w-0">
                          <span className="label-text mb-0.5">বাড়তি কাজ</span>
                          <div className="min-h-6 flex items-center px-1 text-sm tabular-nums">
                            {displayModalValue(recordModal.extra)}
                          </div>
                        </div>
                        <div className="form-control w-full min-w-0">
                          <span className="label-text mb-0.5">অ্যাডভান্স</span>
                          <div className="min-h-6 flex items-center px-1 text-sm tabular-nums">
                            {displayModalValue(recordModal.advance)}
                          </div>
                        </div>
                        <div className="form-control w-full min-w-0">
                          <span className="label-text mb-0.5">রিটার্ন</span>
                          <div className="min-h-6 flex items-center px-1 text-sm tabular-nums">
                            {displayModalValue(recordModal.return)}
                          </div>
                        </div>
                      </div>
                      <div className="form-control w-full">
                        <span className="label-text mb-0.5">নোট</span>
                        <div className="min-h-6 flex items-center px-1 text-sm">
                          {recordModal.note?.trim() ? recordModal.note : "—"}
                        </div>
                      </div>
                    </div>
                    {SHOW_BILLING ? (
                      <div className="form-control w-full">
                        <span className="label-text mb-0.5">বিলিং</span>
                        <div className="min-h-6 flex items-center px-1 text-sm">
                          {billingFullLabelForRow(recordModal)}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
                {sessionLink ? (
                  <div className="border-t border-base-300 pt-2 flex items-center justify-between gap-3">
                    <span className="label-text leading-snug">
                      হিসাবে দেওয়া
                      {sessionLink.period ? (
                        <span className="block whitespace-nowrap">
                          ({sessionLink.period})
                        </span>
                      ) : null}
                    </span>
                    <Link
                      to={`${paths.labourDetail(sessionLink.labourId)}?session=${encodeURIComponent(sessionLink.sessionId)}`}
                      className="link link-primary text-sm tabular-nums whitespace-nowrap"
                    >
                      {formatBnSigned(sessionLink.settlement)}
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {recordModal &&
          !(
            recordModalView === MODAL_VIEWS.history &&
            canShowRecordHistory &&
            !modalEditing &&
            !modalDeleting
          ) ? (
            modalEditable ? (
              isCreateModal ? (
                <div className="modal-action mt-2 shrink-0 justify-between gap-2">
                  {createFormSelected ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetRecordModal}
                    >
                      রিসেট
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={applyRecordModalDefaults}
                    >
                      ডিফল্ট
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveRecordModal}
                    disabled={!recordModalCanSet || modalSaving}
                    title={
                      recordModalCanSet
                        ? undefined
                        : MEANINGFUL_DAY_VALUE_MESSAGE
                    }
                  >
                    {modalSaving ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : null}
                    সেট করুন
                  </button>
                </div>
              ) : (
                <div className="modal-action mt-2 shrink-0 justify-stretch gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost flex-1"
                    onClick={cancelModalEdit}
                    disabled={modalSaving}
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    onClick={confirmModalUpdate}
                    disabled={!recordModalCanSet || modalSaving}
                    title={
                      recordModalCanSet
                        ? undefined
                        : !recordModalDirty
                          ? "কোনো পরিবর্তন নেই।"
                          : MEANINGFUL_DAY_VALUE_MESSAGE
                    }
                  >
                    {modalSaving ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : null}
                    আপডেট নিশ্চিত
                  </button>
                </div>
              )
            ) : recordIdOf(recordModal) ? (
              <div className="modal-action mt-2 shrink-0 justify-stretch gap-2">
                {modalDeleting ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost flex-1"
                      onClick={cancelModalDelete}
                      disabled={modalSaving}
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      className="btn btn-error flex-1"
                      onClick={confirmModalDelete}
                      disabled={modalSaving}
                    >
                      {modalSaving ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : null}
                      ডিলিট নিশ্চিত
                    </button>
                  </>
                ) : (
                  <>
                    {canDeleteRecord ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-error flex-1"
                        disabled={!canDeleteRecord}
                        title={
                          recordSealedOf(recordModal)
                            ? "এই হাজিরার হিসাব দেওয়া হয়েছে"
                            : !canDeleteDailyRecord
                              ? "ডিলিট অনুমতি নেই"
                              : undefined
                        }
                        onClick={startModalDelete}
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} />
                        ডিলিট
                      </button>
                    ) : null}
                    {canUpdateRecord ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-primary flex-1"
                        disabled={!canUpdateRecord}
                        title={
                          recordSealedOf(recordModal)
                            ? "এই হাজিরার হিসাব দেওয়া হয়েছে"
                            : !canChangeDailyRecord
                              ? "আপডেট অনুমতি নেই"
                              : undefined
                        }
                        onClick={startModalEdit}
                      >
                        <Pencil className="size-4" strokeWidth={1.75} />
                        আপডেট
                      </button>
                    ) : null}
                    {recordSealedOf(recordModal) &&
                    !canDeleteRecord &&
                    !canUpdateRecord ? (
                      <p className="flex-1 text-sm text-center text-base-content/70 bg-base-200/80 rounded-md px-3 py-2">
                        {messageForCode("record_sealed")}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : isCreateModal &&
              isCreateBlockedByLastSession(
                recordModal,
                recordModal.date || date,
              ) ? (
              <div className="modal-action mt-2 shrink-0">
                <p className="w-full text-sm text-center text-warning bg-warning/10 rounded-md px-3 py-2">
                  {lastSessionCreateBlockedMessage(recordModal)}
                </p>
              </div>
            ) : null
          ) : null}
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>
  );
}
