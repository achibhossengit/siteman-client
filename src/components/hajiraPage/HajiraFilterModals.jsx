import { PRESENT_OPTIONS } from "../../api/types/hajira.js";
import { SHOW_BILLING } from "../../config/features.js";
import { NULL_BILLING_LABEL } from "../../utils/format.js";
import {
  BILLING_FILTER_MODAL_ID,
  EARNINGS_FILTER_MODAL_ID,
  EARNINGS_FILTER_OPTIONS,
  HAJIRA_FILTER_MODAL_ID,
  HAJIRA_FILTER_OPTIONS,
  LABOUR_FILTER_MODAL_ID,
  LABOUR_FILTER_OPTIONS,
  PAYMENT_FILTER_MODAL_ID,
  PAYMENT_FILTER_OPTIONS,
} from "./constants.js";
import {
  isBulkAttendanceDirty,
  isBulkAttendanceZeroInvalid,
  isBulkPaymentDirty,
  isLastCheckedFilter,
  numOrEmpty,
  toggleRequiredFilter,
} from "./helpers.js";

export function HajiraFilterModals({
  labourFilter,
  setLabourFilter,
  earningsFilter,
  setEarningsFilter,
  hajiraFilter,
  setHajiraFilter,
  showBulkSection,
  bulkSetEnabled = true,
  bulkAttendance,
  setBulkAttendance,
  onHajiraBulkReset,
  hasHajiraBulkReset,
  onHajiraBulkDefault,
  onHajiraBulkCustom,
  paymentFilter,
  setPaymentFilter,
  bulkPayment,
  setBulkPayment,
  onPaymentBulkReset,
  hasPaymentBulkReset,
  onPaymentBulkDefault,
  onPaymentBulkCustom,
  billingFilterOptions,
  billingFilter,
  toggleBillingFilter,
  onBillingBulkCustom,
  billingOptions,
  onBillingBulkReset,
  hasBillingBulkReset,
}) {
  return (
    <>
      <dialog id={LABOUR_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8 shrink-0">নাম</h3>
          <div className="flex flex-col gap-3 pt-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-wrap gap-3">
              {LABOUR_FILTER_OPTIONS.map((opt) => {
                const checked = labourFilter.includes(opt.value);
                const locked = isLastCheckedFilter(labourFilter, opt.value);
                return (
                  <label
                    key={opt.value}
                    className={[
                      "inline-flex items-center gap-2 text-sm",
                      locked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={checked}
                      disabled={locked}
                      onChange={() => {
                        setLabourFilter((prev) =>
                          toggleRequiredFilter(prev, opt.value),
                        );
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>

      <dialog id={EARNINGS_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8 shrink-0">আয়</h3>
          <div className="flex flex-col gap-3 pt-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {EARNINGS_FILTER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={earningsFilter.includes(opt.value)}
                    onChange={() => {
                      setEarningsFilter((prev) =>
                        prev.includes(opt.value)
                          ? prev.filter((value) => value !== opt.value)
                          : [...prev, opt.value],
                      );
                    }}
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

      <dialog id={HAJIRA_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8 shrink-0">হাজিরা</h3>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pt-3">
            <div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {HAJIRA_FILTER_OPTIONS.map((opt) => {
                  const checked = hajiraFilter.includes(opt.value);
                  const locked = isLastCheckedFilter(hajiraFilter, opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={[
                        "inline-flex items-center gap-2 text-sm",
                        locked
                          ? "cursor-not-allowed opacity-70"
                          : "cursor-pointer",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={checked}
                        disabled={locked}
                        onChange={() => {
                          setHajiraFilter((prev) =>
                            toggleRequiredFilter(prev, opt.value),
                          );
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {showBulkSection ? (
              <div className="space-y-3 border-t border-base-300 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="form-control w-full min-w-0">
                    <span className="label-text text-sm">হাজিরা</span>
                    <select
                      className="select select-bordered select-sm w-full"
                      value={
                        bulkAttendance.present === "" ||
                        bulkAttendance.present == null
                          ? "0"
                          : String(bulkAttendance.present)
                      }
                      disabled={!bulkSetEnabled}
                      onChange={(e) => {
                        const present = e.target.value;
                        setBulkAttendance((m) => ({
                          ...m,
                          present,
                          ...(Number(present) === 0 ? { salary: "" } : {}),
                        }));
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
                    <span className="label-text text-sm">বেতন</span>
                    <input
                      type="number"
                      min={0}
                      className="input input-bordered input-sm w-full tabular-nums"
                      value={bulkAttendance.salary}
                      disabled={
                        !bulkSetEnabled || Number(bulkAttendance.present) === 0
                      }
                      onChange={(e) =>
                        setBulkAttendance((m) => ({
                          ...m,
                          salary: numOrEmpty(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="modal-action pt-1 flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={onHajiraBulkReset}
                    disabled={!bulkSetEnabled || !hasHajiraBulkReset}
                  >
                    রিসেট
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={onHajiraBulkDefault}
                      disabled={!bulkSetEnabled}
                    >
                      ডিফল্ট সেট
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={onHajiraBulkCustom}
                      disabled={
                        !bulkSetEnabled ||
                        !isBulkAttendanceDirty(bulkAttendance) ||
                        isBulkAttendanceZeroInvalid(bulkAttendance)
                      }
                    >
                      সেট করুন
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>

      <dialog id={PAYMENT_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8 shrink-0">লেনদেন</h3>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pt-3">
            <div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {PAYMENT_FILTER_OPTIONS.map((opt) => {
                  const checked = paymentFilter.includes(opt.value);
                  const locked = isLastCheckedFilter(paymentFilter, opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={[
                        "inline-flex items-center gap-2 text-sm",
                        locked
                          ? "cursor-not-allowed opacity-70"
                          : "cursor-pointer",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={checked}
                        disabled={locked}
                        onChange={() => {
                          setPaymentFilter((prev) =>
                            toggleRequiredFilter(prev, opt.value),
                          );
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {showBulkSection ? (
              <div className="space-y-3 border-t border-base-300 pt-3">
                <label className="form-control w-full">
                  <span className="label-text text-sm">খোরাকি</span>
                  <input
                    type="number"
                    min={0}
                    className="input input-bordered input-sm w-full tabular-nums"
                    value={bulkPayment.payment}
                    disabled={!bulkSetEnabled}
                    onChange={(e) =>
                      setBulkPayment((m) => ({
                        ...m,
                        payment: numOrEmpty(e.target.value),
                      }))
                    }
                  />
                </label>
                <div className="modal-action pt-1 flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={onPaymentBulkReset}
                    disabled={!bulkSetEnabled || !hasPaymentBulkReset}
                  >
                    রিসেট
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={onPaymentBulkDefault}
                      disabled={!bulkSetEnabled}
                    >
                      ডিফল্ট সেট
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={onPaymentBulkCustom}
                      disabled={!bulkSetEnabled || !isBulkPaymentDirty(bulkPayment)}
                    >
                      সেট করুন
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>

      {SHOW_BILLING ? (
      <dialog id={BILLING_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8 shrink-0">বিলিং</h3>
          <div className="flex-1 min-h-0 overflow-y-auto pt-3 space-y-4">
            <div>
              <div className="flex flex-col gap-2">
                {billingFilterOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="inline-flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={
                        Array.isArray(billingFilter)
                          ? billingFilter.includes(opt.value)
                          : billingFilter === opt.value
                      }
                      onChange={() => toggleBillingFilter(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {showBulkSection ? (
              <div className="space-y-3 border-t border-base-300 pt-3">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm justify-start font-normal"
                    onClick={() => onBillingBulkCustom("none")}
                  >
                    {NULL_BILLING_LABEL}
                  </button>
                  {billingOptions.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="btn btn-ghost btn-sm justify-start font-normal"
                      onClick={() => onBillingBulkCustom(String(b.id))}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
                <div className="modal-action pt-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={onBillingBulkReset}
                    disabled={!hasBillingBulkReset}
                  >
                    রিসেট
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>
      ) : null}
    </>
  );
}
