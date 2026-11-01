import { useState } from "react";
import { PRESENT_OPTIONS } from "../../api/types/hajira.js";
import { SHOW_BILLING } from "../../config/features.js";
import { NULL_BILLING_LABEL } from "../../utils/format.js";
import {
  BILLING_FILTER_MODAL_ID,
  EARNINGS_FILTER_MODAL_ID,
  EARNINGS_FILTER_OPTIONS,
  HAJIRA_FILTER_OPTIONS,
  LABOUR_FILTER_OPTIONS,
} from "./constants.js";
import {
  emptyBulkAttendance,
  emptyBulkPayment,
  isBulkAttendanceDirty,
  isBulkPaymentDirty,
  isLastCheckedFilter,
  numOrEmpty,
  toggleRequiredFilter,
} from "./helpers.js";

const HAJIRA_PANEL_TABS = [
  { id: "default", label: "ডিফল্ট" },
  { id: "custom", label: "কাস্টম" },
  { id: "legend", label: "পরিচিতি" },
];

const HAJIRA_CELL_MAP = [
  { label: "উপস্থিতি × বেতন", tone: "" },
  { label: "বাড়তি কাজ", tone: "text-success" },
  { label: "খোরাকি", tone: "text-error" },
  { label: "অ্যাডভান্স + হিসাবের সময় নেওয়া", tone: "text-error" },
  { label: "রিটার্ন", tone: "text-info" },
  { label: "হিসাবের সময় ফেরত", tone: "text-info" },
];

export function LabourFilterPanel({ labourFilter, setLabourFilter, onClose }) {
  const selectedId = labourFilter.includes("labour") ? "labour" : "record";
  return (
    <div className="flex flex-col gap-0.5">
      {LABOUR_FILTER_OPTIONS.map((opt) => {
        const active = opt.value === selectedId;
        return (
          <button
            key={opt.value}
            type="button"
            className={[
              "btn btn-ghost btn-sm justify-start font-normal h-auto min-h-8 py-1.5 whitespace-normal text-left w-full",
              active ? "bg-base-300 hover:bg-base-300" : "",
            ].join(" ")}
            onClick={() => {
              if (opt.value === "labour") {
                setLabourFilter(["record", "labour"]);
              } else {
                setLabourFilter(["record"]);
              }
              onClose?.();
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function HajiraCellMap() {
  return (
    <div
      className="grid grid-cols-2 overflow-hidden rounded-box border border-base-content/20 text-center text-xs leading-tight"
      aria-label="হাজিরা সেল মানচিত্র"
    >
      {HAJIRA_CELL_MAP.map((cell, index) => (
        <div
          key={cell.label}
          className={[
            "flex min-h-12 items-center justify-center px-2 py-2",
            index % 2 === 0
              ? "border-r border-base-content/15"
              : "",
            index < 4 ? "border-b border-base-content/15" : "",
            cell.tone,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {cell.label}
        </div>
      ))}
    </div>
  );
}

export function HajiraColumnFilterPanel({
  hajiraFilter,
  setHajiraFilter,
  showSalary,
  onShowSalaryChange,
  showBulkSection,
  bulkSetEnabled = true,
  bulkAttendance,
  setBulkAttendance,
  onHajiraBulkDefault,
  onHajiraBulkCustom,
  bulkPayment,
  setBulkPayment,
}) {
  const [activeTab, setActiveTab] = useState(
    showBulkSection ? "default" : "legend",
  );
  const visibleTabs = showBulkSection
    ? HAJIRA_PANEL_TABS
    : HAJIRA_PANEL_TABS.filter((tab) => tab.id === "legend");
  const safeActiveTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "legend";
  const formSelected =
    isBulkAttendanceDirty(bulkAttendance) || isBulkPaymentDirty(bulkPayment);
  const presentProvided =
    bulkAttendance.present !== "" &&
    bulkAttendance.present != null &&
    Number(bulkAttendance.present) !== 0;
  const salaryProvided =
    bulkAttendance.salary !== "" && bulkAttendance.salary != null;
  const customCanSet =
    bulkSetEnabled &&
    (presentProvided || salaryProvided || isBulkPaymentDirty(bulkPayment));

  return (
    <div className="flex flex-col gap-3">
      {HAJIRA_FILTER_OPTIONS.length > 0 ? (
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
      ) : null}
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          className="checkbox checkbox-xs"
          checked={Boolean(showSalary)}
          onChange={(e) => onShowSalaryChange(e.target.checked)}
        />
        <span>বেতন দেখান</span>
      </label>

      {visibleTabs.length > 1 ? (
        <div role="tablist" className="tabs tabs-box tabs-xs w-full">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={safeActiveTab === tab.id}
              className={[
                "tab flex-1 !px-1 leading-tight whitespace-normal",
                safeActiveTab === tab.id ? "tab-active" : "",
              ].join(" ")}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {showBulkSection && safeActiveTab === "default" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-base-content/80">
            প্রত্যেক শ্রমিকের জন্য তার ডিফল্ট উপস্থিতি, বেতন ও খোরাকি বসানো
            হবে। ডিফল্ট মান বদলাতে শ্রমিকের প্রোফাইলে যান।
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm self-end"
            onClick={onHajiraBulkDefault}
            disabled={!bulkSetEnabled}
          >
            সেট করুন
          </button>
        </div>
      ) : null}

      {showBulkSection && safeActiveTab === "custom" ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
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
                  setBulkAttendance((m) => ({
                    ...m,
                    present: e.target.value,
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
                inputMode="numeric"
                className="input input-bordered input-sm w-full tabular-nums"
                value={bulkAttendance.salary}
                disabled={!bulkSetEnabled}
                onChange={(e) =>
                  setBulkAttendance((m) => ({
                    ...m,
                    salary: numOrEmpty(e.target.value),
                  }))
                }
              />
            </label>
            <label className="form-control w-full min-w-0">
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
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setBulkAttendance(emptyBulkAttendance());
                setBulkPayment(emptyBulkPayment());
              }}
              disabled={!formSelected}
            >
              রিসেট
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onHajiraBulkCustom}
              disabled={!customCanSet}
            >
              সেট করুন
            </button>
          </div>
        </div>
      ) : null}

      {safeActiveTab === "legend" ? <HajiraCellMap /> : null}
    </div>
  );
}

export function HajiraFilterModals({
  earningsFilter,
  setEarningsFilter,
  showBulkSection,
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
