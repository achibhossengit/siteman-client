import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateLabourDailyRecord } from "../../api/labours.js";
import {
  createSiteDailyRecords,
  fetchActiveBillingCategories,
  fetchSiteActiveLabour,
  fetchSiteDailyRecordsByDate,
  fetchSiteDailyRecordsPendingLog,
} from "../../api/sites.js";
import {
  PRESENT_OPTIONS,
  buildHajiraEditRows,
  buildHajiraViewRows,
  toDailyRecordPayload,
  toDailyRecordPatchPayload,
} from "../../api/types/hajira.js";
import {
  activityCellToneClass,
  activityTextToneClass,
  activityToneClass,
  applyActivitiesToViewRows,
  snapshotFields,
} from "../../api/types/activity.js";
import { reviewActivities } from "../../api/activities.js";
import { messageForCode, parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { PERMS, hasPermissionSuffix } from "../../utils/permissions.js";
import {
  concatBillingName,
  formatBnNumber,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import {
  confirmAction,
  toastApiError,
  toastInfo,
  toastSuccess,
} from "../../utils/feedback.js";
import {
  readSelectedDate,
  readSelectedSite,
  todayIso,
} from "../../utils/sessionSelection.js";
import { paths } from "../../router/paths.js";

const MODAL_VIEWS = {
  detail: "detail",
  history: "history",
};

const ATTENDANCE_LOG_FIELD_LABELS = {
  present: "হাজিরা",
  salary: "বেতন",
  wage: "বেতন",
  extra: "বাড়তি",
  extra_earn: "বাড়তি",
  note: "নোট",
  billing: "বিলিং",
  billing_id: "বিলিং",
  date: "তারিখ",
};

const PAYMENT_LOG_FIELD_LABELS = {
  amount: "পরিমাণ",
  fooding_pay: "পেমেন্ট",
  advance_pay: "অ্যাডভান্স",
  return_amount: "রিটার্ন",
  payment: "পেমেন্ট",
  advance: "অ্যাডভান্স",
  return: "রিটার্ন",
  note: "নোট",
  type: "ধরন",
  date: "তারিখ",
};

const paymentTypeLabel = (value) => {
  if (value === "payment") return "পেমেন্ট";
  if (value === "advance") return "অ্যাডভান্স";
  if (value === "return") return "রিটার্ন";
  return value == null || value === "" ? "—" : String(value);
};

const formatLogDateTimeBn = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
};

const formatLogDateTimePartsBn = (iso) => {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: new Intl.DateTimeFormat("bn-BD", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    }).format(d),
    time: new Intl.DateTimeFormat("bn-BD", {
      hour: "numeric",
      minute: "2-digit",
    }).format(d),
  };
};

const DateTimeStacked = ({ iso, className = "" }) => {
  const { date, time } = formatLogDateTimePartsBn(iso);
  return (
    <span
      className={["inline-flex flex-col leading-tight", className]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{date}</span>
      {time ? <span>{time}</span> : null}
    </span>
  );
};

const shortActionLabel = (action) => {
  if (action === "updated") return "আপডেট";
  if (action === "deleted") return "ডিলিট";
  return "তৈরি";
};

const activityChangeEntries = (changes) => {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return [];
  }
  return Object.entries(changes).map(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ("old" in value || "new" in value)
    ) {
      return { key, isDiff: true, old: value.old, next: value.new };
    }
    if (Array.isArray(value) && value.length >= 2) {
      return { key, isDiff: true, old: value[0], next: value[1] };
    }
    return { key, isDiff: false, value };
  });
};

const formatHajiraLogValue = (key, value, billingNameFn) => {
  if (value == null || value === "" || value === "None" || value === "null") {
    if (key === "billing" || key === "billing_id") return NULL_BILLING_LABEL;
    return "—";
  }
  if (key === "type") return paymentTypeLabel(value);
  if (key === "billing" || key === "billing_id") {
    return billingDiffLabel(value, billingNameFn);
  }
  if (
    key === "present" ||
    key === "salary" ||
    key === "wage" ||
    key === "extra" ||
    key === "extra_earn" ||
    key === "amount" ||
    key === "fooding_pay" ||
    key === "advance_pay" ||
    key === "return_amount" ||
    key === "payment" ||
    key === "advance" ||
    key === "return"
  ) {
    return formatDiffNumber(value);
  }
  if (typeof value === "boolean") return value ? "হ্যাঁ" : "না";
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const summarizeAttendanceLog = (log, billingNameFn) => {
  if (!log) return "—";
  const fields = snapshotFields(log.changes);
  const bits = [];
  if (fields.present != null && fields.present !== "") {
    bits.push(formatHajiraLogValue("present", fields.present, billingNameFn));
  }
  const extra = fields.extra_earn ?? fields.extra;
  if (extra != null && Number(extra) > 0) {
    bits.push(`বাড়তি ${formatHajiraLogValue("extra", extra, billingNameFn)}`);
  }
  if (fields.billing != null || fields.billing_id != null) {
    bits.push(
      formatHajiraLogValue(
        "billing",
        fields.billing ?? fields.billing_id,
        billingNameFn,
      ),
    );
  }
  if (fields.note != null && fields.note !== "") bits.push(String(fields.note));
  return bits.length ? bits.join(" · ") : "—";
};

const summarizePaymentLog = (log, billingNameFn) => {
  if (!log) return "—";
  const fields = snapshotFields(log.changes);
  const bits = [];
  if (fields.type) bits.push(paymentTypeLabel(fields.type));
  const payment = fields.fooding_pay ?? fields.payment ?? fields.amount;
  const advance = fields.advance_pay ?? fields.advance;
  const ret = fields.return_amount ?? fields.return;
  if (payment != null && payment !== "") {
    bits.push(
      `পেমেন্ট ${formatHajiraLogValue("amount", payment, billingNameFn)}`,
    );
  }
  if (advance != null && advance !== "") {
    bits.push(
      `অ্যাডভান্স ${formatHajiraLogValue("amount", advance, billingNameFn)}`,
    );
  }
  if (ret != null && ret !== "") {
    bits.push(`রিটার্ন ${formatHajiraLogValue("amount", ret, billingNameFn)}`);
  }
  if (fields.note != null && fields.note !== "") bits.push(String(fields.note));
  return bits.length ? bits.join(" · ") : "—";
};

const HistoryBiboron = ({ log, billingNameFn, summarize }) => {
  if (!log) return "—";
  if (log.action === "updated") {
    const entries = activityChangeEntries(log.changes).filter((e) => e.isDiff);
    if (!entries.length) return "—";
    return (
      <span className="inline">
        {entries.map((entry, index) => (
          <Fragment key={entry.key}>
            {index > 0 ? (
              <span className="text-base-content/40"> · </span>
            ) : null}
            <ChangePair
              oldText={formatHajiraLogValue(
                entry.key,
                entry.old,
                billingNameFn,
              )}
              newText={formatHajiraLogValue(
                entry.key,
                entry.next,
                billingNameFn,
              )}
            />
          </Fragment>
        ))}
      </span>
    );
  }
  return summarize(log, billingNameFn);
};

const EntityHistoryPanel = ({
  isLoading,
  error,
  logs,
  expandedId,
  setExpandedId,
  fieldLabels,
  billingNameFn,
  summarize,
  snapshotKeys,
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-1 justify-center items-center py-8">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }
  if (error) {
    return <ApiErrorAlert error={parseApiError(error)} />;
  }
  if (!logs.length) {
    return (
      <p className="text-sm text-base-content/60 text-center py-8">
        কোনো হিস্ট্রি নেই।
      </p>
    );
  }

  return (
    <table className="table table-sm w-full">
      <thead>
        <tr className="border-b border-base-300">
          <th className="w-28 sm:w-32">তারিখ</th>
          <th>বিবরণ</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => {
          const open = expandedId === log.id;
          const reviewed = Boolean(log.reviewed_at);
          const fields = snapshotFields(log.changes);
          const logChanges = activityChangeEntries(log.changes);
          return (
            <Fragment key={log.id}>
              <tr
                className={[
                  "border-b border-base-300/70 cursor-pointer hover:bg-base-200/60",
                  activityToneClass(log.action),
                  reviewed ? "opacity-50" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setExpandedId(open ? null : log.id)}
              >
                <td className="text-xs tabular-nums text-base-content/70 align-middle whitespace-nowrap">
                  <DateTimeStacked iso={log.created_at} />
                </td>
                <td className="text-sm leading-snug align-middle max-w-0">
                  <div className="truncate">
                    <HistoryBiboron
                      log={log}
                      billingNameFn={billingNameFn}
                      summarize={summarize}
                    />
                  </div>
                </td>
              </tr>
              {open ? (
                <tr
                  className={[
                    "border-b border-base-300/70",
                    reviewed ? "opacity-50" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td colSpan={2} className="bg-base-200/40 px-2 py-1.5">
                    <div className="flex flex-col gap-0.5 text-xs leading-snug pb-1.5 mb-1.5 border-b border-base-300">
                      <p>
                        <span className="text-base-content/50">
                          {shortActionLabel(log.action)}:{" "}
                        </span>
                        <span className={activityTextToneClass(log.action)}>
                          {log.actor_name || "—"}
                        </span>
                        <span className="text-base-content/60">
                          {" "}
                          ({formatLogDateTimeBn(log.created_at)})
                        </span>
                      </p>
                      <p>
                        <span className="text-base-content/50">অডিট: </span>
                        {log.reviewed_at ? (
                          <>
                            <span>{log.reviewed_by_name || "—"}</span>
                            <span className="text-base-content/60">
                              {" "}
                              ({formatLogDateTimeBn(log.reviewed_at)})
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-0.5 text-xs leading-snug">
                      {log.action === "updated" ? (
                        logChanges.length ? (
                          logChanges.map((entry) => (
                            <div key={entry.key} className="flex gap-1.5">
                              <span className="w-16 shrink-0 text-base-content/60">
                                {fieldLabels[entry.key] ?? entry.key}
                              </span>
                              <span className="min-w-0">
                                {entry.isDiff ? (
                                  <ChangePair
                                    oldText={formatHajiraLogValue(
                                      entry.key,
                                      entry.old,
                                      billingNameFn,
                                    )}
                                    newText={formatHajiraLogValue(
                                      entry.key,
                                      entry.next,
                                      billingNameFn,
                                    )}
                                  />
                                ) : (
                                  formatHajiraLogValue(
                                    entry.key,
                                    entry.value,
                                    billingNameFn,
                                  )
                                )}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-base-content/50">
                            কোনো পরিবর্তন নেই।
                          </p>
                        )
                      ) : (
                        snapshotKeys.map((key) => (
                          <div key={key} className="flex gap-1.5">
                            <span className="w-16 shrink-0 text-base-content/60">
                              {fieldLabels[key] ?? key}
                            </span>
                            <span>
                              {formatHajiraLogValue(
                                key,
                                key === "billing"
                                  ? (fields.billing ?? fields.billing_id)
                                  : fields[key],
                                billingNameFn,
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

const cloneRows = (rows) => structuredClone(rows);

const sameDisplay = (a, b) => String(a ?? "") === String(b ?? "");

const normalizeBillingRef = (value) => {
  if (value == null || value === "" || value === "None" || value === "null") {
    return null;
  }
  if (typeof value === "object") {
    const id = value.id ?? value.pk;
    if (id == null || id === "") return null;
    return String(id);
  }
  return String(value);
};

const billingDiffLabel = (value, billingNameFn) => {
  if (value == null || value === "" || value === "None" || value === "null") {
    return NULL_BILLING_LABEL;
  }
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    const id = value.id ?? value.pk;
    return id == null || id === "" ? NULL_BILLING_LABEL : billingNameFn(id);
  }
  const asNum = Number(value);
  if (Number.isFinite(asNum) && String(value).trim() === String(asNum)) {
    return billingNameFn(asNum);
  }
  return String(value);
};

const formatDiffNumber = (value) => {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? formatBnNumber(n) : String(value);
};

const formatDiffText = (value) => {
  if (value == null || value === "") return "—";
  return String(value);
};

/** Previous (struck) + current value for update diffs in detail modals. */
const ChangePair = ({ oldText, newText, newClassName = "" }) => {
  if (oldText == null || sameDisplay(oldText, newText)) {
    return <span className={newClassName}>{newText}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      <span className="line-through opacity-50">{oldText}</span>
      <span className={newClassName}>{newText}</span>
    </span>
  );
};

/**
 * Build ~~old~~ → current pair for one activity field.
 * Returns null when unchanged / no update diff.
 */
const diffPairFor = (diffs, field, current, format = formatDiffText) => {
  const entry =
    diffs?.[field] ?? (field === "billing" ? diffs?.billing_id : null);
  if (!entry) return null;

  let currentValue = current ?? entry.new;
  if (
    field === "billing" &&
    normalizeBillingRef(current) === normalizeBillingRef(entry.old)
  ) {
    currentValue = entry.new;
  }

  if (field === "billing") {
    if (
      normalizeBillingRef(entry.old) === normalizeBillingRef(currentValue)
    ) {
      return null;
    }
  } else if (sameDisplay(entry.old, currentValue)) {
    return null;
  }

  return {
    oldText: format(entry.old),
    newText: format(currentValue),
  };
};

const numOrEmpty = (value) => {
  if (value === "" || value == null) return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
};

const hasPresent = (row) => row.present !== "" && row.present != null;

const hasExtra = (row) => Number(row.extra) > 0;

const hasBilling = (row) => row.billing !== "" && row.billing != null;

/** present=0 with extra=0 is not a valid attendance. */
const isZeroPresentAndExtra = (row) => {
  if (!hasPresent(row)) return false;
  return Number(row.present) === 0 && (Number(row.extra) || 0) === 0;
};

const ZERO_PRESENT_EXTRA_MESSAGE =
  "হাজিরা ও বাড়তি দুটোই ০ হতে পারে না।";

const presentEarnings = (row) => {
  if (!hasPresent(row)) return 0;
  const salary =
    row.salary === "" || row.salary == null ? 0 : Number(row.salary);
  return Number(row.present) * salary;
};

const dayEarnings = (row, earningsFilter = "earn") => {
  const fromPresent = presentEarnings(row);
  const fromExtra = Number(row.extra) || 0;
  if (earningsFilter === "from_present") return fromPresent;
  if (earningsFilter === "from_extra") return fromExtra;
  return fromPresent + fromExtra;
};

const hajiraTotalValue = (row, hajiraFilter = "hajira") => {
  if (hajiraFilter === "salary") {
    return row.salary !== "" && row.salary != null ? Number(row.salary) || 0 : 0;
  }
  if (hajiraFilter === "extra") return Number(row.extra) || 0;
  return hasPresent(row) ? Number(row.present) || 0 : 0;
};

const attendanceCellLines = (row, billingNameFn, selectedFields) => {
  const lines = [];
  if (selectedFields.includes("present") && hasPresent(row)) {
    lines.push({
      key: "present",
      value: formatBnNumber(row.present),
      isNumber: true,
    });
  }
  if (
    selectedFields.includes("salary") &&
    row.salary !== "" &&
    row.salary != null
  ) {
    lines.push({
      key: "salary",
      value: formatBnNumber(row.salary),
      isNumber: true,
    });
  }
  if (selectedFields.includes("extra") && hasExtra(row)) {
    lines.push({
      key: "extra",
      value: formatBnNumber(row.extra),
      isNumber: true,
    });
  }
  if (selectedFields.includes("billing") && hasBilling(row)) {
    lines.push({
      key: "billing",
      value: billingNameFn(row.billing),
      isNumber: false,
    });
  }
  return lines.length ? lines : [{ key: "empty", value: "—", isNumber: false }];
};

const paymentAmountOf = (row) => {
  if (row.payment === "" || row.payment == null) return 0;
  return Number(row.payment) || 0;
};

const advanceAmountOf = (row) => {
  if (row.advance === "" || row.advance == null) return 0;
  return Number(row.advance) || 0;
};

const returnAmountOf = (row) => {
  if (row.return === "" || row.return == null) return 0;
  return Number(row.return) || 0;
};

const hasAmount = (value) => value !== "" && value != null;

const isAttendanceDirty = (row, initial) =>
  String(row.present) !== String(initial.present) ||
  String(row.salary) !== String(initial.salary) ||
  Number(row.extra) !== Number(initial.extra) ||
  String(row.extraNote ?? "") !== String(initial.extraNote ?? "") ||
  String(row.billing ?? "") !== String(initial.billing ?? "");

const isPaymentDirty = (row, initial, key) =>
  String(row[key] ?? "") !== String(initial[key] ?? "") ||
  String(row[`${key}Note`] ?? "") !== String(initial[`${key}Note`] ?? "");

const hasAttendanceData = (row) =>
  hasPresent(row) ||
  hasExtra(row) ||
  Boolean(row.extraNote?.trim()) ||
  Boolean(row.billing) ||
  hasAmount(row.payment) ||
  hasAmount(row.advance) ||
  hasAmount(row.return) ||
  Boolean(row.paymentNote?.trim()) ||
  Boolean(row.advanceNote?.trim()) ||
  Boolean(row.returnNote?.trim());

const recordIdOf = (row) =>
  row?.recordId ?? row?.attendanceId ?? row?.paymentId ?? null;

const recordSealedOf = (row) =>
  Boolean(
    row?.recordSealed ||
      row?.attendanceSealed ||
      row?.paymentSealed ||
      row?.advanceSealed ||
      row?.returnSealed,
  );

const HAJIRA_MODAL_ID = "hajira_attendance_modal";
const PAYMENT_MODAL_ID = "hajira_payment_modal";
const HAJIRA_BULK_MODAL_ID = "hajira_bulk_attendance_modal";
const PAYMENT_BULK_MODAL_ID = "hajira_bulk_payment_modal";
const EARNINGS_FILTER_MODAL_ID = "hajira_earnings_filter_modal";
const PAYMENT_FILTER_MODAL_ID = "hajira_payment_filter_modal";
const HAJIRA_FILTER_MODAL_ID = "hajira_hajira_filter_modal";

const emptyBulkAttendance = () => ({
  present: "",
  salary: "",
  extra: "",
  note: "",
  billing: "",
});

const emptyBulkPayment = () => ({
  payment: "",
  paymentNote: "",
});

const isBulkAttendanceDirty = (form) =>
  form.present !== "" ||
  (form.salary !== "" && form.salary != null) ||
  (form.extra !== "" && form.extra != null) ||
  Boolean(form.note?.trim()) ||
  (form.billing !== "" && form.billing != null);

const isBulkPaymentDirty = (form) =>
  (form.payment !== "" && form.payment != null) ||
  Boolean(form.paymentNote?.trim());

const isBulkAttendanceZeroInvalid = (form) => {
  if (form.present === "" || form.present == null) return false;
  return (
    Number(form.present) === 0 && (Number(form.extra) || 0) === 0
  );
};

const HAJIRA_FILTER_OPTIONS = [
  { value: "present", label: "উপস্থিতি" },
  { value: "salary", label: "বেতন" },
  { value: "extra", label: "বাড়তি" },
  { value: "billing", label: "বিলিং" },
];

const HAJIRA_FILTER_TABS = {
  display: "display",
  billing: "billing",
};

const EARNINGS_FILTER_OPTIONS = [
  { value: "earn", label: "আয়" },
  { value: "from_present", label: "বেতন" },
  { value: "from_extra", label: "বাড়তি" },
];

const PAYMENT_FILTER_OPTIONS = [
  { value: "payment", label: "পেমেন্ট" },
  { value: "advance", label: "অ্যাডভান্স" },
  { value: "return", label: "রিটার্ন" },
];

const filterLabel = (options, value) =>
  options.find((opt) => opt.value === value)?.label ?? options[0]?.label ?? "";

/** Bulk review validation: attr ids + missing id details. */
const formatBulkReviewError = (parsed) => {
  const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
  const idsError = errors.find((e) => e.attr === "ids");
  const missingIds = errors
    .filter((e) => e.attr === "missing")
    .map((e) => e.rawDetail ?? e.detail)
    .filter(Boolean);

  if (idsError || missingIds.length) {
    const main =
      idsError?.rawDetail ||
      idsError?.detail ||
      "কিছু অ্যাক্টিভিটি লগ রিভিউ করা যায়নি।";
    if (!missingIds.length) return String(main);
    return `${main} (missing: ${missingIds.join(", ")})`;
  }

  return parsed?.message || messageForCode("error");
};

const PAYMENT_SPECS = [
  {
    key: "payment",
    noteKey: "paymentNote",
    idKey: "paymentId",
    sealedKey: "paymentSealed",
    type: "payment",
    label: "পেমেন্ট",
  },
  {
    key: "advance",
    noteKey: "advanceNote",
    idKey: "advanceId",
    sealedKey: "advanceSealed",
    type: "advance",
    label: "অ্যাডভান্স",
  },
  {
    key: "return",
    noteKey: "returnNote",
    idKey: "returnId",
    sealedKey: "returnSealed",
    type: "return",
    label: "রিটার্ন",
  },
];

const isRecordDirty = (row, initial) =>
  isAttendanceDirty(row, initial) ||
  PAYMENT_SPECS.some((spec) => isPaymentDirty(row, initial, spec.key));

/** gray = unchanged, success = create, amber = update */
const fieldTone = (row, initial, keys, idKey) => {
  const changed = (Array.isArray(keys) ? keys : [keys]).some(
    (k) => String(row[k] ?? "") !== String(initial[k] ?? ""),
  );
  if (!changed) return "text-base-content/60";
  return row[idKey] ? "text-amber-500" : "text-success";
};

const paymentLineTone = (row, initial, keys, idKey, typeClass) => {
  const tone = fieldTone(row, initial, keys, idKey);
  return tone === "text-base-content/60" ? typeClass : tone;
};

export const HajiraPage = () => {
  const { date: selectedDate, siteId: selectedSiteId, sites } =
    useOutletContext();
  const { can, profile, isCompanyAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const canAddDailyRecord = can(PERMS.addDailyRecord);
  const canChangeDailyRecord = can(PERMS.changeDailyRecord);
  const canViewLabour = can(PERMS.viewLabour);
  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, "view_activitylog");
  const canChangeActivityLog =
    can(PERMS.changeActivityLog) ||
    hasPermissionSuffix(profile, "change_activitylog");

  const siteId = selectedSiteId || readSelectedSite();
  const date = selectedDate || readSelectedDate() || todayIso();
  const site = (sites ?? []).find((s) => String(s.id) === String(siteId));
  const siteInactive = site?.is_active === false;

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState([]);
  const [initialRows, setInitialRows] = useState([]);
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [hajiraModal, setHajiraModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [hajiraModalView, setHajiraModalView] = useState(MODAL_VIEWS.detail);
  const [paymentModalView, setPaymentModalView] = useState(MODAL_VIEWS.detail);
  const [expandedHajiraHistoryId, setExpandedHajiraHistoryId] = useState(null);
  const [expandedPaymentHistoryId, setExpandedPaymentHistoryId] =
    useState(null);
  const [earningsFilter, setEarningsFilter] = useState("earn");
  const [paymentFilter, setPaymentFilter] = useState([
    "payment",
    "advance",
    "return",
  ]);
  const [billingFilter, setBillingFilter] = useState("all");
  const [hajiraFilter, setHajiraFilter] = useState([
    "present",
    "extra",
    "billing",
  ]);
  const [hajiraFilterTab, setHajiraFilterTab] = useState(
    HAJIRA_FILTER_TABS.display,
  );
  const [bulkAttendance, setBulkAttendance] = useState(emptyBulkAttendance);
  const [bulkPayment, setBulkPayment] = useState(emptyBulkPayment);

  const showAyColumn = Boolean(isCompanyAdmin) && !editing;

  const dailyRecordsQuery = useQuery({
    queryKey: ["sites", siteId, "daily-records", { date }],
    queryFn: async () => {
      const { data } = await fetchSiteDailyRecordsByDate(siteId, date);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId && date),
  });

  const billingQuery = useQuery({
    queryKey: ["sites", siteId, "active-billing"],
    queryFn: async () => {
      const { data } = await fetchActiveBillingCategories(siteId);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId),
  });

  const activeLabourQuery = useQuery({
    queryKey: ["sites", siteId, "active_labour"],
    queryFn: async () => {
      const { data } = await fetchSiteActiveLabour(siteId);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(editing && siteId),
  });

  const pendingLogQueryKey = useMemo(
    () => ["sites", siteId, "daily-records", date, "pending_log"],
    [siteId, date],
  );

  const pendingLogQuery = useQuery({
    queryKey: pendingLogQueryKey,
    queryFn: async () => {
      const { data } = await fetchSiteDailyRecordsPendingLog(siteId, date);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(!editing && canViewActivityLog && siteId && date),
  });

  const activityIdsForRow = (row) =>
    (row?.activityLogs ?? [])
      .map((log) => Number(log.id))
      .filter((id) => Number.isFinite(id));

  const canShowPaymentHistory = Boolean(recordIdOf(paymentModal));

  const sortLogsDesc = (logs) =>
    [...logs].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

  /** Modal history from day pending_log (dedicated, unpaginated) — not /activities. */
  const attendanceHistoryLogs = useMemo(() => {
    const entityId = recordIdOf(hajiraModal);
    if (entityId == null) return [];
    const logs = (pendingLogQuery.data ?? []).filter(
      (log) => Number(log.entity_id) === Number(entityId),
    );
    return sortLogsDesc(logs);
  }, [pendingLogQuery.data, hajiraModal]);

  const paymentHistoryLogs = useMemo(() => {
    const entityId = recordIdOf(paymentModal);
    if (entityId == null) return [];
    const logs = (pendingLogQuery.data ?? []).filter(
      (log) => Number(log.entity_id) === Number(entityId),
    );
    return sortLogsDesc(logs);
  }, [pendingLogQuery.data, paymentModal]);

  const paymentHistoryLoading =
    Boolean(recordIdOf(paymentModal)) && pendingLogQuery.isLoading;

  const paymentHistoryError = pendingLogQuery.error;

  const billingOptions = billingQuery.data ?? [];

  const billingLabelById = useMemo(() => {
    const map = new Map();
    for (const b of billingOptions) map.set(String(b.id), b.name);
    return map;
  }, [billingOptions]);

  const billingFullLabel = (id) => {
    if (id == null || id === "") return NULL_BILLING_LABEL;
    return billingLabelById.get(String(id)) ?? `#${id}`;
  };

  const billingLabel = (id) => {
    if (id == null || id === "") return NULL_BILLING_LABEL;
    const full = billingLabelById.get(String(id));
    if (!full) return `#${id}`;
    return concatBillingName(full);
  };

  const billingFilterOptions = useMemo(
    () => [
      { value: "all", label: "সব" },
 
      { value: "none", label: NULL_BILLING_LABEL },
      ...billingOptions.map((b) => ({
        value: String(b.id),
        label: b.name,
      })),
    ],
    [billingOptions],
  );

  const billingFilterHeaderLabel =
    billingFilter === "all"
      ? "বিলিং"
      : billingFilter === "none"
        ? NULL_BILLING_LABEL
        : billingLabel(billingFilter);

  const openHajiraFilterModal = (tab = HAJIRA_FILTER_TABS.display) => {
    setHajiraFilterTab(tab);
    document.getElementById(HAJIRA_FILTER_MODAL_ID)?.showModal();
  };

  // Exit edit/select mode when site/date changes.
  useEffect(() => {
    setEditing(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setApiError(null);
    setHajiraModal(null);
    setPaymentModal(null);
    setEarningsFilter("earn");
    setPaymentFilter(["payment", "advance", "return"]);
    setBillingFilter("all");
    setHajiraFilter(["present", "extra", "billing"]);
  }, [siteId, date]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [earningsFilter, paymentFilter, billingFilter, hajiraFilter]);

  // View mode: daily records for the day (+ pending activity tones).
  useEffect(() => {
    if (editing) return;
    if (!dailyRecordsQuery.isSuccess) return;
    let next = buildHajiraViewRows(dailyRecordsQuery.data ?? []);
    if (canViewActivityLog) {
      next = applyActivitiesToViewRows(next, pendingLogQuery.data ?? []);
    }
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  }, [
    editing,
    canViewActivityLog,
    dailyRecordsQuery.isSuccess,
    dailyRecordsQuery.data,
    pendingLogQuery.data,
  ]);

  // Edit mode: remap already-loaded records onto this site's active labours.
  useEffect(() => {
    if (!editing) return;
    if (!activeLabourQuery.isSuccess) return;
    const next = buildHajiraEditRows(
      activeLabourQuery.data ?? [],
      dailyRecordsQuery.data ?? [],
    );
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  }, [
    editing,
    activeLabourQuery.isSuccess,
    activeLabourQuery.data,
    dailyRecordsQuery.data,
  ]);

  const updateRow = (labourId, patch) => {
    setRows((prev) =>
      prev.map((row) =>
        row.labourId === labourId ? { ...row, ...patch } : row,
      ),
    );
  };

  const initialByLabour = useMemo(() => {
    const map = new Map();
    for (const r of initialRows) map.set(r.labourId, r);
    return map;
  }, [initialRows]);

  const isDirty = useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(initialRows),
    [rows, initialRows],
  );

  const viewEarningsFilter = editing ? "earn" : earningsFilter;
  const viewPaymentFilter = editing
    ? ["payment", "advance", "return"]
    : paymentFilter;
  const viewBillingFilter = editing ? "all" : billingFilter;
  const viewHajiraFields = editing
    ? ["present", "extra", "billing"]
    : hajiraFilter;
  const viewHajiraFilter = viewHajiraFields.includes("present")
    ? "present"
    : viewHajiraFields.includes("salary")
      ? "salary"
      : viewHajiraFields.includes("extra")
        ? "extra"
        : "present";

  const visibleRows = useMemo(() => {
    if (viewBillingFilter === "all") return rows;
    if (viewBillingFilter === "none") {
      return rows.filter((row) => row.billing == null || row.billing === "");
    }
    return rows.filter(
      (row) => String(row.billing ?? "") === String(viewBillingFilter),
    );
  }, [rows, viewBillingFilter]);

  const pendingIds = useMemo(() => {
    const ids = new Set();
    for (const row of visibleRows) {
      for (const id of activityIdsForRow(row)) ids.add(id);
    }
    return [...ids];
  }, [visibleRows]);

  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));
  const somePendingSelected = pendingIds.some((id) => selectedIds.has(id));

  const totals = useMemo(() => {
    let present = 0;
    let earnings = 0;
    let payment = 0;
    let advance = 0;
    let ret = 0;
    for (const row of visibleRows) {
      present += hajiraTotalValue(row, viewHajiraFilter);
      earnings += dayEarnings(row, viewEarningsFilter);
      if (viewPaymentFilter.includes("payment")) {
        payment += paymentAmountOf(row);
      }
      if (viewPaymentFilter.includes("advance")) {
        advance += advanceAmountOf(row);
      }
      if (viewPaymentFilter.includes("return")) {
        ret += returnAmountOf(row);
      }
    }
    return { present, earnings, payment, advance, return: ret };
  }, [visibleRows, viewEarningsFilter, viewPaymentFilter, viewHajiraFilter]);

  const showPaymentAmount = (row) =>
    viewPaymentFilter.includes("payment") && paymentAmountOf(row) !== 0;

  const showAdvanceAmount = (row) =>
    viewPaymentFilter.includes("advance") && advanceAmountOf(row) !== 0;

  const showReturnAmount = (row) =>
    viewPaymentFilter.includes("return") && returnAmountOf(row) !== 0;

  const modalEditable = editing;

  const attendanceLocked = (row) =>
    recordSealedOf(row) ||
    (recordIdOf(row) ? !canChangeDailyRecord : !canAddDailyRecord);

  /** One sealed daily record — same create/change rights for every payment slot. */
  const paymentSlotLocked = (row, _spec) => attendanceLocked(row);

  const openHajiraModal = (row) => {
    setHajiraModalView(MODAL_VIEWS.detail);
    setExpandedHajiraHistoryId(null);
    setHajiraModal({
      labourId: row.labourId,
      labourName: row.labourName,
      present: row.present === "" ? "" : String(row.present),
      salary: row.salary,
      extra: row.extra || "",
      note: row.extraNote ?? "",
      billing: row.billing ?? "",
      recordId: row.recordId ?? row.attendanceId ?? null,
      recordSealed: row.recordSealed ?? row.attendanceSealed,
      attendanceSealed: row.attendanceSealed,
      attendanceId: row.attendanceId,
      attendanceCreatedAt: row.attendanceCreatedAt ?? null,
      attendanceUpdatedAt: row.attendanceUpdatedAt ?? null,
      attendanceDiffs: row.attendanceDiffs ?? null,
    });
    document.getElementById(HAJIRA_MODAL_ID)?.showModal();
  };

  const saveHajiraModal = () => {
    if (!hajiraModal || !modalEditable || attendanceLocked(hajiraModal)) return;
    const next = {
      present:
        hajiraModal.present === "" ? "" : Number(hajiraModal.present),
      salary: numOrEmpty(hajiraModal.salary),
      extra:
        hajiraModal.extra === "" || hajiraModal.extra == null
          ? 0
          : Number(hajiraModal.extra),
      extraNote: hajiraModal.note ?? "",
      billing: hajiraModal.billing ?? "",
    };
    if (isZeroPresentAndExtra(next)) {
      toastInfo(ZERO_PRESENT_EXTRA_MESSAGE);
      return;
    }
    updateRow(hajiraModal.labourId, next);
    document.getElementById(HAJIRA_MODAL_ID)?.close();
  };

  const resetHajiraModal = () => {
    if (!hajiraModal) return;
    const initial = initialByLabour.get(hajiraModal.labourId);
    if (!initial) return;
    setHajiraModal({
      ...hajiraModal,
      present: initial.present === "" ? "" : String(initial.present),
      salary: initial.salary,
      extra: initial.extra || "",
      note: initial.extraNote ?? "",
      billing: initial.billing ?? "",
    });
  };

  const applyHajiraModalDefaults = () => {
    if (!hajiraModal || !modalEditable || attendanceLocked(hajiraModal)) return;
    const row = rows.find((r) => r.labourId === hajiraModal.labourId);
    if (!row) return;
    setHajiraModal((m) => {
      if (!m) return m;
      const blank = (value) => value === "" || value == null;
      const present = blank(m.present)
        ? row.defaultAttendance === "" || row.defaultAttendance == null
          ? ""
          : String(row.defaultAttendance)
        : m.present;
      const salary = blank(m.salary) ? row.defaultSalary : m.salary;
      return { ...m, present, salary };
    });
  };

  const openPaymentModal = (row) => {
    setPaymentModalView(MODAL_VIEWS.detail);
    setExpandedPaymentHistoryId(null);
    setPaymentModal({
      labourId: row.labourId,
      labourName: row.labourName,
      recordId: row.recordId ?? row.paymentId ?? null,
      payment: row.payment,
      paymentNote: row.paymentNote ?? "",
      paymentSealed: row.paymentSealed,
      paymentId: row.paymentId,
      paymentCreatedAt: row.paymentCreatedAt ?? null,
      paymentUpdatedAt: row.paymentUpdatedAt ?? null,
      advance: row.advance,
      advanceNote: row.advanceNote ?? "",
      advanceSealed: row.advanceSealed,
      advanceId: row.advanceId,
      advanceCreatedAt: row.advanceCreatedAt ?? null,
      advanceUpdatedAt: row.advanceUpdatedAt ?? null,
      return: row.return,
      returnNote: row.returnNote ?? "",
      returnSealed: row.returnSealed,
      returnId: row.returnId,
      returnCreatedAt: row.returnCreatedAt ?? null,
      returnUpdatedAt: row.returnUpdatedAt ?? null,
      paymentDiffs: row.paymentDiffs ?? null,
      returnDiffs: row.returnDiffs ?? null,
    });
    document.getElementById(PAYMENT_MODAL_ID)?.showModal();
  };

  const savePaymentModal = () => {
    if (!paymentModal || !modalEditable) return;
    const patch = {};
    for (const spec of PAYMENT_SPECS) {
      if (paymentSlotLocked(paymentModal, spec)) continue;
      patch[spec.key] = numOrEmpty(paymentModal[spec.key]);
      patch[spec.noteKey] = paymentModal[spec.noteKey] ?? "";
    }
    updateRow(paymentModal.labourId, patch);
    document.getElementById(PAYMENT_MODAL_ID)?.close();
  };

  const resetPaymentModal = () => {
    if (!paymentModal) return;
    const initial = initialByLabour.get(paymentModal.labourId);
    if (!initial) return;
    const patch = {};
    for (const spec of PAYMENT_SPECS) {
      if (paymentSlotLocked(paymentModal, spec)) continue;
      patch[spec.key] = initial[spec.key];
      patch[spec.noteKey] = initial[spec.noteKey] ?? "";
    }
    if (!Object.keys(patch).length) return;
    setPaymentModal({
      ...paymentModal,
      ...patch,
    });
  };

  const applyPaymentModalDefaults = () => {
    if (!paymentModal || !modalEditable) return;
    const spec = PAYMENT_SPECS[0];
    if (paymentSlotLocked(paymentModal, spec)) return;
    const row = rows.find((r) => r.labourId === paymentModal.labourId);
    if (!row) return;
    setPaymentModal((m) => {
      if (!m) return m;
      if (m.payment !== "" && m.payment != null) return m;
      return { ...m, payment: row.defaultFooding };
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleRowSelected = (row, checked) => {
    const ids = activityIdsForRow(row);
    if (!ids.length) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? new Set(pendingIds) : new Set());
  };

  const onAcceptChanges = async () => {
    const ids = [...selectedIds];
    if (!canChangeActivityLog || ids.length === 0) return;
    const ok = await confirmAction({
      title: "অডিট নিশ্চিত করুন",
      text: `${formatBnNumber(ids.length)}টি হাজিরা অ্যাক্টিভিটি রিভিউড হবে। পরে বাতিল করা যাবে না।`,
      confirmText: "অডিট করুন",
      cancelText: "বাতিল",
    });
    if (!ok) return;

    setReviewing(true);
    setApiError(null);
    try {
      await reviewActivities(ids);
      exitSelectMode();
      const reviewed = new Set(ids.map((id) => Number(id)));
      const dropReviewed = (logs) =>
        (Array.isArray(logs) ? logs : []).filter(
          (log) => !reviewed.has(Number(log?.id)),
        );
      queryClient.setQueryData(pendingLogQueryKey, dropReviewed);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: pendingLogQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["activities", "list"] }),
      ]);
      toastSuccess("অডিট সম্পন্ন হয়েছে");
    } catch (err) {
      const parsed = parseApiError(err);
      const message = formatBulkReviewError(parsed);
      setApiError({ ...parsed, message });
      toastApiError({
        message,
        errors: [{ code: null, detail: message, attr: null }],
      });
    } finally {
      setReviewing(false);
    }
  };

  const onStartEdit = () => {
    exitSelectMode();
    setApiError(null);
    setEditing(true);
  };

  const isBlank = (value) => value === "" || value == null;

  const applyAttendanceDefaults = () => {
    setRows((prev) =>
      prev.map((row) => {
        if (attendanceLocked(row)) return row;
        return {
          ...row,
          present: isBlank(row.present) ? row.defaultAttendance : row.present,
          salary: isBlank(row.salary) ? row.defaultSalary : row.salary,
        };
      }),
    );
  };

  const applyPaymentDefaults = () => {
    const paymentSpec = PAYMENT_SPECS[0];
    setRows((prev) =>
      prev.map((row) => {
        if (paymentSlotLocked(row, paymentSpec)) return row;
        return {
          ...row,
          payment: isBlank(row.payment) ? row.defaultFooding : row.payment,
        };
      }),
    );
  };

  const openHajiraBulkModal = () => {
    setBulkAttendance(emptyBulkAttendance());
    document.getElementById(HAJIRA_BULK_MODAL_ID)?.showModal();
  };

  const openPaymentBulkModal = () => {
    setBulkPayment(emptyBulkPayment());
    document.getElementById(PAYMENT_BULK_MODAL_ID)?.showModal();
  };

  const onHajiraBulkDefault = () => {
    applyAttendanceDefaults();
    document.getElementById(HAJIRA_BULK_MODAL_ID)?.close();
  };

  const onHajiraBulkCustom = () => {
    if (!isBulkAttendanceDirty(bulkAttendance)) return;
    if (isBulkAttendanceZeroInvalid(bulkAttendance)) {
      toastInfo(ZERO_PRESENT_EXTRA_MESSAGE);
      return;
    }

    const customWouldBeInvalid = rows.some((row) => {
      if (attendanceLocked(row)) return false;
      const next = {
        present:
          bulkAttendance.present === ""
            ? row.present
            : Number(bulkAttendance.present),
        extra:
          bulkAttendance.extra === "" || bulkAttendance.extra == null
            ? row.extra
            : Number(bulkAttendance.extra),
      };
      return isZeroPresentAndExtra(next);
    });
    if (customWouldBeInvalid) {
      toastInfo(ZERO_PRESENT_EXTRA_MESSAGE);
      return;
    }

    setRows((prev) =>
      prev.map((row) => {
        if (attendanceLocked(row)) return row;
        return {
          ...row,
          present:
            bulkAttendance.present === ""
              ? row.present
              : Number(bulkAttendance.present),
          salary:
            bulkAttendance.salary === "" || bulkAttendance.salary == null
              ? row.salary
              : Number(bulkAttendance.salary),
          extra:
            bulkAttendance.extra === "" || bulkAttendance.extra == null
              ? row.extra
              : Number(bulkAttendance.extra),
          extraNote:
            bulkAttendance.note === ""
              ? row.extraNote
              : bulkAttendance.note,
          billing:
            bulkAttendance.billing === ""
              ? row.billing
              : bulkAttendance.billing,
        };
      }),
    );
    document.getElementById(HAJIRA_BULK_MODAL_ID)?.close();
  };

  const onPaymentBulkDefault = () => {
    applyPaymentDefaults();
    document.getElementById(PAYMENT_BULK_MODAL_ID)?.close();
  };

  const onPaymentBulkCustom = () => {
    if (!isBulkPaymentDirty(bulkPayment)) return;
    const paymentSpec = PAYMENT_SPECS[0];
    setRows((prev) =>
      prev.map((row) => {
        if (paymentSlotLocked(row, paymentSpec)) return row;
        return {
          ...row,
          payment:
            bulkPayment.payment === "" || bulkPayment.payment == null
              ? row.payment
              : Number(bulkPayment.payment),
          paymentNote:
            bulkPayment.paymentNote === ""
              ? row.paymentNote
              : bulkPayment.paymentNote,
        };
      }),
    );
    document.getElementById(PAYMENT_BULK_MODAL_ID)?.close();
  };

  const onHajiraBulkReset = () => {
    setRows((prev) =>
      prev.map((row) => {
        if (attendanceLocked(row)) return row;
        const initial = initialByLabour.get(row.labourId);
        if (!initial) return row;
        return {
          ...row,
          present: initial.present,
          salary: initial.salary,
          extra: initial.extra,
          extraNote: initial.extraNote,
          billing: initial.billing,
        };
      }),
    );
    setBulkAttendance(emptyBulkAttendance());
    document.getElementById(HAJIRA_BULK_MODAL_ID)?.close();
  };

  const onPaymentBulkReset = () => {
    setRows((prev) =>
      prev.map((row) => {
        const initial = initialByLabour.get(row.labourId);
        if (!initial) return row;
        let next = row;
        for (const spec of PAYMENT_SPECS) {
          if (paymentSlotLocked(row, spec)) continue;
          next = {
            ...next,
            [spec.key]: initial[spec.key],
            [spec.noteKey]: initial[spec.noteKey],
          };
        }
        return next;
      }),
    );
    setBulkPayment(emptyBulkPayment());
    document.getElementById(PAYMENT_BULK_MODAL_ID)?.close();
  };

  const hasHajiraBulkReset =
    rows.some((row) => {
      if (attendanceLocked(row)) return false;
      const initial = initialByLabour.get(row.labourId);
      return initial ? isAttendanceDirty(row, initial) : false;
    }) || isBulkAttendanceDirty(bulkAttendance);

  const hasPaymentBulkReset =
    rows.some((row) => {
      const initial = initialByLabour.get(row.labourId);
      if (!initial) return false;
      return PAYMENT_SPECS.some(
        (spec) =>
          !paymentSlotLocked(row, spec) && isPaymentDirty(row, initial, spec.key),
      );
    }) || isBulkPaymentDirty(bulkPayment);

  const onCancel = () => {
    setEditing(false);
    setApiError(null);
    let next = buildHajiraViewRows(dailyRecordsQuery.data ?? []);
    if (canViewActivityLog) {
      next = applyActivitiesToViewRows(next, pendingLogQuery.data ?? []);
    }
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const creates = [];
      const updates = [];
      let blocked = 0;

      for (const row of rows) {
        const initial =
          initialRows.find((r) => r.labourId === row.labourId) ?? row;

        if (recordSealedOf(row)) continue;
        if (!isRecordDirty(row, initial)) continue;

        const recordId = recordIdOf(row);
        if (recordId) {
          if (!canChangeDailyRecord) {
            blocked += 1;
            continue;
          }
          updates.push({
            labourId: row.labourId,
            id: recordId,
            payload: toDailyRecordPatchPayload(row),
          });
        } else if (hasAttendanceData(row)) {
          if (!canAddDailyRecord) {
            blocked += 1;
            continue;
          }
          creates.push(toDailyRecordPayload(row, date));
        }
      }

      if (creates.length) {
        await createSiteDailyRecords(siteId, creates);
      }

      await Promise.all(
        updates.map((item) =>
          updateLabourDailyRecord(item.labourId, item.id, item.payload),
        ),
      );

      return {
        creates: creates.length,
        updates: updates.length,
        blocked,
      };
    },
  });

  const onSave = async () => {
    setApiError(null);
    const invalidZero = rows.some((row) => {
      const initial =
        initialRows.find((r) => r.labourId === row.labourId) ?? row;
      if (
        !isAttendanceDirty(row, initial) ||
        recordSealedOf(row) ||
        !(recordIdOf(row) || hasAttendanceData(row))
      ) {
        return false;
      }
      return isZeroPresentAndExtra(row);
    });
    if (invalidZero) {
      toastInfo(ZERO_PRESENT_EXTRA_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const result = await saveMutation.mutateAsync();
      const total = result.creates + result.updates;
      if (total === 0) {
        toastInfo(
          result.blocked > 0
            ? messageForCode("permission_denied")
            : "সেভ করার মতো কোনো পরিবর্তন নেই।",
        );
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ["sites", siteId, "daily-records"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sites", siteId, "daily-reports"],
      });
      toastSuccess("হাজিরা ও পেমেন্ট সেভ হয়েছে");
    } catch (err) {
      setApiError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!siteId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-base-content/70">
        হাজিরা দেখতে একটি সাইট নির্বাচন করুন।
      </div>
    );
  }

  const loading =
    dailyRecordsQuery.isLoading ||
    (editing && activeLabourQuery.isLoading);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const loadError =
    dailyRecordsQuery.error ||
    (editing ? activeLabourQuery.error : null);
  if (loadError) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        <ApiErrorAlert error={parseApiError(loadError)} />
      </div>
    );
  }

  const emptyMessage = editing
    ? "এই সাইটে কোনো সক্রিয় লেবার নেই।"
    : "এই তারিখে কোনো হাজিরা নেই।";

  const hajiraModalLocked =
    !modalEditable || !hajiraModal || attendanceLocked(hajiraModal);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {apiError ? <ApiErrorAlert error={apiError} /> : null}

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="table table-fixed table-sm sm:table-md w-full">
          <colgroup>
            <col className="w-10" />
            <col className="w-[28%]" />
            <col className="w-[24%]" />
            {showAyColumn ? <col className="w-[14%]" /> : null}
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-base-100">
            <tr className="border-b border-base-300 text-sm">
              <th>
                {!editing && selectMode && canChangeActivityLog ? (
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allPendingSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          somePendingSelected && !allPendingSelected;
                      }
                    }}
                    disabled={pendingIds.length === 0}
                    aria-label="সব নির্বাচন"
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                ) : !editing && canChangeActivityLog ? (
                  <button
                    type="button"
                    className="font-bold"
                    onClick={() => setSelectMode(true)}
                    title="নির্বাচন মোড"
                  >
                    নং
                  </button>
                ) : (
                  "নং"
                )}
              </th>
              <th>নাম</th>
              <th className="text-right">
                {editing ? (
                  <button type="button" onClick={openHajiraBulkModal}>
                    হাজিরা
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openHajiraFilterModal()}
                  >
                    হাজিরা
                  </button>
                )}
              </th>
              {showAyColumn ? (
                <th className="text-right">
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(EARNINGS_FILTER_MODAL_ID)
                        ?.showModal()
                    }
                  >
                    {filterLabel(EARNINGS_FILTER_OPTIONS, earningsFilter)}
                  </button>
                </th>
              ) : null}
              <th className="text-right">
                {editing ? (
                  <button type="button" onClick={openPaymentBulkModal}>
                    লেনদেন
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(PAYMENT_FILTER_MODAL_ID)
                        ?.showModal()
                    }
                  >
                    লেনদেন
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={showAyColumn ? 5 : 4}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const initial = initialByLabour.get(row.labourId) ?? {};
                const rowActivityIds = activityIdsForRow(row);
                const selectable = rowActivityIds.length > 0;
                const rowSelected =
                  selectable &&
                  rowActivityIds.every((id) => selectedIds.has(id));
                const hajiraEditTone = editing
                  ? fieldTone(
                      row,
                      initial,
                      ["present", "salary", "extra", "extraNote", "billing"],
                      "attendanceId",
                    )
                  : "";
                const hajiraViewTone = !editing
                  ? activityTextToneClass(row.attendanceTone) ||
                    "text-base-content/70"
                  : "";
                const hajiraGroupTone = editing
                  ? hajiraEditTone
                  : hajiraViewTone;
                const hajiraCellBg =
                  !editing ? activityCellToneClass(row.attendanceTone) : "";
                const paymentCellBg =
                  !editing ? activityCellToneClass(row.paymentTone) : "";
                const paymentActivityTone = !editing
                  ? activityTextToneClass(row.paymentTone)
                  : "";
                const earn = dayEarnings(row, viewEarningsFilter);
                const showPay = showPaymentAmount(row);
                const showAdv = showAdvanceAmount(row);
                const showRet = showReturnAmount(row);
                const attendanceLines = attendanceCellLines(
                  row,
                  billingFullLabel,
                  viewHajiraFields,
                );

                return (
                  <tr
                    key={row.labourId}
                    className="border-b border-base-300/70"
                  >
                    <td className="tabular-nums text-base-content/60">
                      {!editing && selectMode && canChangeActivityLog ? (
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={rowSelected}
                          disabled={!selectable}
                          aria-label={`নির্বাচন ${formatBnNumber(index + 1)}`}
                          onChange={(e) =>
                            toggleRowSelected(row, e.target.checked)
                          }
                        />
                      ) : (
                        formatBnNumber(index + 1)
                      )}
                    </td>
                    <td className="font-medium whitespace-nowrap max-w-28 truncate">
                      {canViewLabour && row.labourId != null ? (
                        <Link
                          to={paths.labourDetail(row.labourId)}
                          className="link link-hover"
                          title={row.labourName}
                        >
                          {row.labourName}
                        </Link>
                      ) : (
                        row.labourName
                      )}
                    </td>
                    <td className={`text-right ${hajiraCellBg}`}>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-xs h-auto min-h-0 px-1 py-0.5 font-normal text-right leading-tight w-full justify-end ${hajiraGroupTone}`}
                        onClick={() => openHajiraModal(row)}
                      >
                        <span className="block w-full space-y-0.5 text-right">
                          {attendanceLines.map((line) => (
                            <span
                              key={line.key}
                              className="block w-full truncate text-right"
                              title={line.value}
                            >
                              <span className={line.isNumber ? "tabular-nums" : ""}>
                                {line.value}
                              </span>
                            </span>
                          ))}
                        </span>
                      </button>
                    </td>
                    {showAyColumn ? (
                      <td className={`text-right ${hajiraCellBg}`}>
                        <button
                          type="button"
                          className={`btn btn-ghost btn-xs h-auto min-h-0 px-1 py-0.5 font-normal tabular-nums w-full justify-end ${hajiraGroupTone}`}
                          onClick={() => openHajiraModal(row)}
                        >
                          {earn ? formatBnNumber(earn) : "—"}
                        </button>
                      </td>
                    ) : null}
                    <td className={`text-right ${paymentCellBg}`}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs h-auto min-h-0 px-1 py-0.5 font-normal text-right leading-tight w-full"
                        onClick={() => openPaymentModal(row)}
                      >
                        {showPay || showAdv || showRet ? (
                          <span className="block w-full tabular-nums space-y-0.5 text-right">
                            {showPay ? (
                              <span
                                className={`block w-full text-right ${
                                  paymentActivityTone ||
                                  (editing
                                    ? paymentLineTone(
                                        row,
                                        initial,
                                        ["payment", "paymentNote"],
                                        "paymentId",
                                        "text-error",
                                      )
                                    : "text-error")
                                }`}
                              >
                                {formatBnNumber(row.payment)}
                              </span>
                            ) : null}
                            {showAdv ? (
                              <span
                                className={`block w-full text-right ${
                                  paymentActivityTone ||
                                  (editing
                                    ? paymentLineTone(
                                        row,
                                        initial,
                                        ["advance", "advanceNote"],
                                        "advanceId",
                                        "text-error",
                                      )
                                    : "text-error")
                                }`}
                              >
                                {formatBnNumber(row.advance)}
                              </span>
                            ) : null}
                            {showRet ? (
                              <span
                                className={`block w-full text-right ${
                                  paymentActivityTone ||
                                  (editing
                                    ? paymentLineTone(
                                        row,
                                        initial,
                                        ["return", "returnNote"],
                                        "returnId",
                                        "text-success",
                                      )
                                    : "text-success")
                                }`}
                              >
                                {formatBnNumber(row.return)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span
                            className={`block w-full text-right ${
                              paymentActivityTone || "text-base-content/60"
                            }`}
                          >
                            —
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {visibleRows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-base-300">
                <td />
                <td className="whitespace-nowrap">মোট</td>
                <td className="text-right tabular-nums">
                  {totals.present ? formatBnNumber(totals.present) : "—"}
                </td>
                {showAyColumn ? (
                  <td className="text-right tabular-nums">
                    {totals.earnings ? formatBnNumber(totals.earnings) : "—"}
                  </td>
                ) : null}
                <td className="text-right">
                  {totals.payment || totals.advance || totals.return ? (
                    <span className="block w-full tabular-nums space-y-0.5 text-right">
                      {totals.payment ? (
                        <span className="block w-full text-right text-error">
                          {formatBnNumber(totals.payment)}
                        </span>
                      ) : null}
                      {totals.advance ? (
                        <span className="block w-full text-right text-error">
                          {formatBnNumber(totals.advance)}
                        </span>
                      ) : null}
                      {totals.return ? (
                        <span className="block w-full text-right text-success">
                          {formatBnNumber(totals.return)}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="block w-full text-right text-base-content/60">
                      —
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {editing ? (
        <div className="fixed bottom-16 right-4 z-40 flex items-center gap-2">
          <button
            type="button"
            className="btn shadow-lg bg-base-100 border border-base-300"
            onClick={onCancel}
            disabled={saving}
          >
            বাতিল করুন
          </button>
          <button
            type="button"
            className="btn btn-primary shadow-lg"
            onClick={onSave}
            disabled={saving || !isDirty || rows.length === 0}
          >
            {saving ? (
              <span className="loading loading-spinner loading-sm" />
            ) : null}
            নিশ্চিত করুন
          </button>
        </div>
      ) : selectMode && canChangeActivityLog ? (
        <div className="fixed bottom-16 inset-x-0 z-40 px-3 pointer-events-none">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-end gap-2 pointer-events-auto">
            <button
              type="button"
              className="btn btn-ghost shadow-lg bg-base-100 border border-base-300"
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
      ) : canAddDailyRecord ? (
        <button
          type="button"
          className="btn btn-primary fixed bottom-16 right-4 z-40 shadow-lg"
          onClick={onStartEdit}
          disabled={!date || siteInactive}
        >
          যোগ করুন
        </button>
      ) : null}

      <dialog
        id={HAJIRA_MODAL_ID}
        className="modal"
        onClose={() => {
          setHajiraModal(null);
          setHajiraModalView(MODAL_VIEWS.detail);
          setExpandedHajiraHistoryId(null);
        }}
      >
        <div className="modal-box max-w-sm h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8 shrink-0">
            {hajiraModal &&
            canViewActivityLog &&
            !editing &&
            hajiraModal.attendanceId ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={
                    hajiraModalView === MODAL_VIEWS.detail
                      ? "text-primary"
                      : "text-base-content/50 hover:text-base-content"
                  }
                  onClick={() => {
                    setHajiraModalView(MODAL_VIEWS.detail);
                    setExpandedHajiraHistoryId(null);
                  }}
                >
                  বিস্তারিত
                </button>
                <button
                  type="button"
                  className={
                    hajiraModalView === MODAL_VIEWS.history
                      ? "text-primary"
                      : "text-base-content/50 hover:text-base-content"
                  }
                  onClick={() => {
                    setHajiraModalView(MODAL_VIEWS.history);
                    setExpandedHajiraHistoryId(null);
                  }}
                >
                  হিস্ট্রি
                </button>
              </div>
            ) : hajiraModal ? (
              `হাজিরা (${hajiraModal.labourName})`
            ) : (
              "হাজিরা"
            )}
          </h3>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {hajiraModal &&
            hajiraModalView === MODAL_VIEWS.history &&
            !editing &&
            hajiraModal.attendanceId ? (
              <EntityHistoryPanel
                isLoading={pendingLogQuery.isLoading}
                error={
                  pendingLogQuery.isError
                    ? pendingLogQuery.error
                    : null
                }
                logs={attendanceHistoryLogs}
                expandedId={expandedHajiraHistoryId}
                setExpandedId={setExpandedHajiraHistoryId}
                fieldLabels={ATTENDANCE_LOG_FIELD_LABELS}
                billingNameFn={billingFullLabel}
                summarize={summarizeAttendanceLog}
                snapshotKeys={[
                  "present",
                  "wage",
                  "salary",
                  "extra_earn",
                  "extra",
                  "note",
                  "billing",
                ]}
              />
            ) : hajiraModal ? (
              <div className="space-y-3">
                {(() => {
                  const showDiffs =
                    hajiraModalLocked && Boolean(hajiraModal.attendanceDiffs);
                  const diffs = showDiffs ? hajiraModal.attendanceDiffs : null;
                  const presentDiff = diffPairFor(
                    diffs,
                    "present",
                    hajiraModal.present,
                    formatDiffNumber,
                  );
                  const salaryDiff = diffPairFor(
                    diffs,
                    "salary",
                    hajiraModal.salary,
                    formatDiffNumber,
                  );
                  const extraDiff = diffPairFor(
                    diffs,
                    "extra",
                    hajiraModal.extra,
                    formatDiffNumber,
                  );
                  const noteDiff = diffPairFor(
                    diffs,
                    "note",
                    hajiraModal.note,
                    formatDiffText,
                  );
                  const billingDiff = diffPairFor(
                    diffs,
                    "billing",
                    hajiraModal.billing,
                    (v) => billingDiffLabel(v, billingFullLabel),
                  );

                  return (
                    <>
                      <label className="form-control w-full">
                        <span className="label-text text-sm">হাজিরা</span>
                        {presentDiff ? (
                          <div className="min-h-8 flex items-center px-1">
                            <ChangePair
                              oldText={presentDiff.oldText}
                              newText={presentDiff.newText}
                              newClassName="tabular-nums"
                            />
                          </div>
                        ) : (
                          <select
                            className="select select-bordered select-sm w-full"
                            value={hajiraModal.present}
                            disabled={hajiraModalLocked}
                            onChange={(e) =>
                              setHajiraModal((m) => ({
                                ...m,
                                present: e.target.value,
                              }))
                            }
                          >
                            <option value="">—</option>
                            {PRESENT_OPTIONS.map((v) => (
                              <option key={v} value={String(v)}>
                                {v}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>

                      <label className="form-control w-full">
                        <span className="label-text text-sm">বেতন</span>
                        {salaryDiff ? (
                          <div className="min-h-8 flex items-center px-1">
                            <ChangePair
                              oldText={salaryDiff.oldText}
                              newText={salaryDiff.newText}
                              newClassName="tabular-nums"
                            />
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full tabular-nums"
                            value={hajiraModal.salary}
                            disabled={hajiraModalLocked}
                            onChange={(e) =>
                              setHajiraModal((m) => ({
                                ...m,
                                salary: numOrEmpty(e.target.value),
                              }))
                            }
                          />
                        )}
                      </label>

                      <label className="form-control w-full">
                        <span className="label-text text-sm">বাড়তি</span>
                        {extraDiff ? (
                          <div className="min-h-8 flex items-center px-1">
                            <ChangePair
                              oldText={extraDiff.oldText}
                              newText={extraDiff.newText}
                              newClassName="tabular-nums"
                            />
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full tabular-nums"
                            value={hajiraModal.extra}
                            disabled={hajiraModalLocked}
                            onChange={(e) =>
                              setHajiraModal((m) => ({
                                ...m,
                                extra: numOrEmpty(e.target.value),
                              }))
                            }
                          />
                        )}
                      </label>

                      <label className="form-control w-full">
                        <span className="label-text text-sm">নোট</span>
                        {noteDiff ? (
                          <div className="min-h-8 flex items-center px-1">
                            <ChangePair
                              oldText={noteDiff.oldText}
                              newText={noteDiff.newText}
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            className="input input-bordered input-sm w-full"
                            value={hajiraModal.note}
                            disabled={hajiraModalLocked}
                            onChange={(e) =>
                              setHajiraModal((m) => ({
                                ...m,
                                note: e.target.value,
                              }))
                            }
                            maxLength={255}
                          />
                        )}
                      </label>

                      {billingDiff ? (
                        <label className="form-control w-full">
                          <span className="label-text text-sm">বিলিং</span>
                          <div className="min-h-8 flex items-center px-1">
                            <ChangePair
                              oldText={billingDiff.oldText}
                              newText={billingDiff.newText}
                            />
                          </div>
                        </label>
                      ) : (
                        <label className="form-control w-full">
                          <span className="label-text text-sm">বিলিং</span>
                          {hajiraModalLocked ? (
                            <div className="min-h-8 flex items-center px-1 text-sm">
                              {billingFullLabel(hajiraModal.billing)}
                            </div>
                          ) : (
                            <select
                              className="select select-bordered select-sm w-full"
                              value={
                                hajiraModal.billing == null ||
                                hajiraModal.billing === ""
                                  ? ""
                                  : String(hajiraModal.billing)
                              }
                              disabled={hajiraModalLocked}
                              onChange={(e) =>
                                setHajiraModal((m) => ({
                                  ...m,
                                  billing: e.target.value,
                                }))
                              }
                            >
                              <option value="">{NULL_BILLING_LABEL}</option>
                              {(() => {
                                const opts = [...billingOptions];
                                const cur = hajiraModal.billing;
                                if (
                                  cur !== "" &&
                                  cur != null &&
                                  !opts.some(
                                    (b) => String(b.id) === String(cur),
                                  )
                                ) {
                                  opts.unshift({
                                    id: cur,
                                    name: billingFullLabel(cur),
                                  });
                                }
                                return opts.map((b) => (
                                  <option key={b.id} value={String(b.id)}>
                                    {b.name}
                                  </option>
                                ));
                              })()}
                            </select>
                          )}
                        </label>
                      )}

                      {!hajiraModalLocked ? (
                        <div className="modal-action pt-1 flex-wrap justify-between gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={resetHajiraModal}
                          >
                            রিসেট করুন
                          </button>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={applyHajiraModalDefaults}
                            >
                              ডিফল্ট
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={saveHajiraModal}
                            >
                              সেট করুন
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>
      </dialog>

      <dialog
        id={PAYMENT_MODAL_ID}
        className="modal"
        onClose={() => {
          setPaymentModal(null);
          setPaymentModalView(MODAL_VIEWS.detail);
          setExpandedPaymentHistoryId(null);
        }}
      >
        <div className="modal-box max-w-sm h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8 shrink-0">
            {paymentModal &&
            canViewActivityLog &&
            !editing &&
            canShowPaymentHistory ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={
                    paymentModalView === MODAL_VIEWS.detail
                      ? "text-primary"
                      : "text-base-content/50 hover:text-base-content"
                  }
                  onClick={() => {
                    setPaymentModalView(MODAL_VIEWS.detail);
                    setExpandedPaymentHistoryId(null);
                  }}
                >
                  বিস্তারিত
                </button>
                <button
                  type="button"
                  className={
                    paymentModalView === MODAL_VIEWS.history
                      ? "text-primary"
                      : "text-base-content/50 hover:text-base-content"
                  }
                  onClick={() => {
                    setPaymentModalView(MODAL_VIEWS.history);
                    setExpandedPaymentHistoryId(null);
                  }}
                >
                  হিস্ট্রি
                </button>
              </div>
            ) : paymentModal ? (
              `লেনদেন (${paymentModal.labourName})`
            ) : (
              "লেনদেন"
            )}
          </h3>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {paymentModal &&
            paymentModalView === MODAL_VIEWS.history &&
            !editing &&
            canShowPaymentHistory ? (
              <EntityHistoryPanel
                isLoading={paymentHistoryLoading}
                error={
                  pendingLogQuery.isError ? paymentHistoryError : null
                }
                logs={paymentHistoryLogs}
                expandedId={expandedPaymentHistoryId}
                setExpandedId={setExpandedPaymentHistoryId}
                fieldLabels={PAYMENT_LOG_FIELD_LABELS}
                billingNameFn={billingFullLabel}
                summarize={summarizePaymentLog}
                snapshotKeys={[
                  "fooding_pay",
                  "advance_pay",
                  "return_amount",
                  "payment",
                  "advance",
                  "return",
                  "amount",
                  "type",
                  "note",
                ]}
              />
            ) : paymentModal ? (
              <div className="space-y-4">
                {PAYMENT_SPECS.map((spec) => {
                  const fieldLocked =
                    !modalEditable || paymentSlotLocked(paymentModal, spec);
                  const slotDiffs = fieldLocked
                    ? spec.key === "return"
                      ? paymentModal.returnDiffs
                      : paymentModal.paymentDiffs
                    : null;
                  const noteDiff = diffPairFor(
                    slotDiffs,
                    "note",
                    paymentModal[spec.noteKey],
                    formatDiffText,
                  );
                  const amountDiff = diffPairFor(
                    slotDiffs,
                    spec.key === "advance" ? "advance" : "amount",
                    paymentModal[spec.key],
                    formatDiffNumber,
                  );
                  return (
                    <div key={spec.key} className="space-y-3">
                      <p className="text-sm font-medium text-base-content/80">
                        {spec.label}
                      </p>
                      <label className="form-control w-full">
                        <span className="label-text text-sm">নোট</span>
                        {noteDiff ? (
                          <div className="min-h-8 flex items-center px-1">
                            <ChangePair
                              oldText={noteDiff.oldText}
                              newText={noteDiff.newText}
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            className="input input-bordered input-sm w-full"
                            value={paymentModal[spec.noteKey]}
                            disabled={fieldLocked}
                            onChange={(e) =>
                              setPaymentModal((m) => ({
                                ...m,
                                [spec.noteKey]: e.target.value,
                              }))
                            }
                            maxLength={255}
                          />
                        )}
                      </label>
                      <label className="form-control w-full">
                        <span className="label-text text-sm">পরিমাণ</span>
                        {amountDiff ? (
                          <div className="min-h-8 flex items-center px-1">
                            <ChangePair
                              oldText={amountDiff.oldText}
                              newText={amountDiff.newText}
                              newClassName="tabular-nums"
                            />
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full tabular-nums"
                            value={paymentModal[spec.key]}
                            disabled={fieldLocked}
                            onChange={(e) =>
                              setPaymentModal((m) => ({
                                ...m,
                                [spec.key]: numOrEmpty(e.target.value),
                              }))
                            }
                          />
                        )}
                      </label>
                    </div>
                  );
                })}

                {modalEditable ? (
                  <div className="modal-action pt-1 flex-wrap justify-between gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={resetPaymentModal}
                      disabled={PAYMENT_SPECS.every((spec) =>
                        paymentSlotLocked(paymentModal, spec),
                      )}
                    >
                      রিসেট করুন
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={applyPaymentModalDefaults}
                        disabled={paymentSlotLocked(
                          paymentModal,
                          PAYMENT_SPECS[0],
                        )}
                      >
                        ডিফল্ট
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={savePaymentModal}
                      >
                        সেট করুন
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </dialog>

      <dialog id={HAJIRA_BULK_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8">হাজিরা</h3>
          <div className="space-y-3 pt-3">
            <label className="form-control w-full">
              <span className="label-text text-sm">হাজিরা</span>
              <select
                className="select select-bordered select-sm w-full"
                value={bulkAttendance.present}
                onChange={(e) =>
                  setBulkAttendance((m) => ({
                    ...m,
                    present: e.target.value,
                  }))
                }
              >
                <option value="">—</option>
                {PRESENT_OPTIONS.map((v) => (
                  <option key={v} value={String(v)}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">বেতন</span>
              <input
                type="number"
                min={0}
                className="input input-bordered input-sm w-full tabular-nums"
                value={bulkAttendance.salary}
                onChange={(e) =>
                  setBulkAttendance((m) => ({
                    ...m,
                    salary: numOrEmpty(e.target.value),
                  }))
                }
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">বাড়তি</span>
              <input
                type="number"
                min={0}
                className="input input-bordered input-sm w-full tabular-nums"
                value={bulkAttendance.extra}
                onChange={(e) =>
                  setBulkAttendance((m) => ({
                    ...m,
                    extra: numOrEmpty(e.target.value),
                  }))
                }
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">নোট</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={bulkAttendance.note}
                onChange={(e) =>
                  setBulkAttendance((m) => ({
                    ...m,
                    note: e.target.value,
                  }))
                }
                maxLength={255}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">বিলিং</span>
              <select
                className="select select-bordered select-sm w-full"
                value={
                  bulkAttendance.billing == null ||
                  bulkAttendance.billing === ""
                    ? ""
                    : String(bulkAttendance.billing)
                }
                onChange={(e) =>
                  setBulkAttendance((m) => ({
                    ...m,
                    billing: e.target.value,
                  }))
                }
              >
                <option value="">—</option>
                <option value="">{NULL_BILLING_LABEL}</option>
                {billingOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-action pt-1 flex-wrap justify-between gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onHajiraBulkReset}
                disabled={!hasHajiraBulkReset}
              >
                রিসেট
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={onHajiraBulkDefault}
                >
                  ডিফল্ট সেট
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onHajiraBulkCustom}
                  disabled={
                    !isBulkAttendanceDirty(bulkAttendance) ||
                    isBulkAttendanceZeroInvalid(bulkAttendance)
                  }
                >
                  কাস্টম সেট
                </button>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog id={PAYMENT_BULK_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8">লেনদেন</h3>
          <div className="space-y-3 pt-3">
            <label className="form-control w-full">
              <span className="label-text text-sm">নোট</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={bulkPayment.paymentNote}
                onChange={(e) =>
                  setBulkPayment((m) => ({
                    ...m,
                    paymentNote: e.target.value,
                  }))
                }
                maxLength={255}
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm">পরিমাণ</span>
              <input
                type="number"
                min={0}
                className="input input-bordered input-sm w-full tabular-nums"
                value={bulkPayment.payment}
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
                disabled={!hasPaymentBulkReset}
              >
                রিসেট
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={onPaymentBulkDefault}
                >
                  ডিফল্ট সেট
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onPaymentBulkCustom}
                  disabled={!isBulkPaymentDirty(bulkPayment)}
                >
                  কাস্টম সেট
                </button>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog id={HAJIRA_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-xs h-[min(24rem,80vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8 shrink-0">হাজিরা</h3>
          <div className="flex items-center gap-4 pt-1 pr-8 shrink-0">
            <button
              type="button"
              className={`text-xs ${
                hajiraFilterTab === HAJIRA_FILTER_TABS.display
                  ? "text-primary font-semibold"
                  : "text-base-content/60"
              }`}
              onClick={() => setHajiraFilterTab(HAJIRA_FILTER_TABS.display)}
            >
              মান দেখান
            </button>
            <button
              type="button"
              className={`text-xs ${
                hajiraFilterTab === HAJIRA_FILTER_TABS.billing
                  ? "text-primary font-semibold"
                  : "text-base-content/60"
              }`}
              onClick={() => setHajiraFilterTab(HAJIRA_FILTER_TABS.billing)}
            >
              বিলিং ফিল্টার
            </button>
          </div>
          <div className="pt-3 space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div
              className={
                hajiraFilterTab === HAJIRA_FILTER_TABS.display ? "" : "hidden"
              }
            >
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {HAJIRA_FILTER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="inline-flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={hajiraFilter.includes(opt.value)}
                      onChange={() => {
                        setHajiraFilter((prev) =>
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

            <div
              className={
                hajiraFilterTab === HAJIRA_FILTER_TABS.billing ? "" : "hidden"
              }
            >
              <div className="menu bg-base-100 w-full p-0">
                {billingFilterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`btn btn-ghost btn-sm justify-start ${
                      billingFilter === opt.value ? "btn-active" : ""
                    }`}
                    onClick={() => {
                      setBillingFilter(opt.value);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog id={EARNINGS_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-xs">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg">আয় ফিল্টার</h3>
          <div className="menu bg-base-100 w-full p-0 pt-3">
            {EARNINGS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn btn-ghost btn-sm justify-start ${
                  earningsFilter === opt.value ? "btn-active" : ""
                }`}
                onClick={() => {
                  setEarningsFilter(opt.value);
                  document.getElementById(EARNINGS_FILTER_MODAL_ID)?.close();
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog id={PAYMENT_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-xs">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg">লেনদেন</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3">
            {PAYMENT_FILTER_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="inline-flex items-center gap-2 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={paymentFilter.includes(opt.value)}
                  onChange={() => {
                    setPaymentFilter((prev) =>
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
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
};
