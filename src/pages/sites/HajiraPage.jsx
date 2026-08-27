import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { PersonAvatar } from "../../components/PersonAvatar.jsx";
import {
  deleteLabourDailyRecord,
  fetchSiteActiveLabour,
  updateLabourDailyRecord,
} from "../../api/labours.js";
import {
  createSiteDailyRecords,
  fetchSiteDailyRecordsByDate,
} from "../../api/sites.js";
import {
  PRESENT_OPTIONS,
  buildHajiraEditRows,
  buildHajiraViewRows,
  toDailyRecordPayload,
  toDailyRecordPatchPayload,
} from "../../api/types/hajira.js";
import {
  activityTextToneClass,
  activityToneClass,
  applyPendingActivitiesToHajiraRows,
  snapshotFields,
} from "../../api/types/activity.js";
import { profileAllowedSiteIds } from "../../api/types/user.js";
import { fetchAllActivities, reviewActivities } from "../../api/activities.js";
import { messageForCode, parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { useBillingLookup } from "../../hooks/useBillingLookup.js";
import { usePermissions } from "../../hooks/usePermissions.js";
import { PERMS, hasPermissionSuffix } from "../../utils/permissions.js";
import {
  concatBillingName,
  concatLabourName,
  formatBnNumber,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import {
  alertError,
  confirmAction,
  toastApiError,
  toastError,
  toastInfo,
  toastSuccess,
} from "../../utils/feedback.js";
import {
  readSelectedDate,
  readSelectedSite,
  todayIso,
} from "../../utils/sessionSelection.js";
import { SHOW_BILLING, visibleFieldItems } from "../../config/features.js";
import { paths } from "../../router/paths.js";

const MODAL_VIEWS = {
  detail: "detail",
  history: "history",
};

const RECORD_LOG_FIELD_LABELS = {
  present: "হাজিরা",
  salary: "বেতন",
  wage: "বেতন",
  extra: "বাড়তি কাজ",
  extra_earn: "বাড়তি কাজ",
  fooding_pay: "খোরাকি",
  advance_pay: "অ্যাডভান্স",
  return_amount: "রিটার্ন",
  payment: "খোরাকি",
  advance: "অ্যাডভান্স",
  return: "রিটার্ন",
  amount: "পরিমাণ",
  note: "নোট",
  billing: "বিলিং",
  billing_id: "বিলিং",
  type: "ধরন",
  date: "তারিখ",
};

/** Canonical history fields (API aliases → one display row). */
const RECORD_HISTORY_FIELDS = [
  { key: "present", aliases: ["present"], kind: "number" },
  { key: "salary", aliases: ["wage", "salary"], kind: "number" },
  { key: "extra", aliases: ["extra_earn", "extra"], kind: "number" },
  { key: "payment", aliases: ["fooding_pay", "payment"], kind: "number" },
  { key: "advance", aliases: ["advance_pay", "advance"], kind: "number" },
  { key: "return", aliases: ["return_amount", "return"], kind: "number" },
  { key: "note", aliases: ["note"], kind: "text" },
  { key: "billing", aliases: ["billing", "billing_id"], kind: "text" },
];

const VISIBLE_HISTORY_FIELDS = visibleFieldItems(RECORD_HISTORY_FIELDS);

const HISTORY_KEY_TO_CANON = Object.fromEntries(
  VISIBLE_HISTORY_FIELDS.flatMap((field) =>
    field.aliases.map((alias) => [alias, field.key]),
  ),
);

const pickHistoryFieldValue = (fields, aliases) => {
  let fallback;
  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(fields, alias)) continue;
    const value = fields[alias];
    if (value != null && value !== "" && value !== "None" && value !== "null") {
      return value;
    }
    if (fallback === undefined) fallback = value;
  }
  return fallback;
};

const historyRowsFromSnapshot = (fields) =>
  VISIBLE_HISTORY_FIELDS.map((field) => ({
    key: field.key,
    kind: field.kind,
    value: pickHistoryFieldValue(fields, field.aliases),
  }));

const historyRowsFromUpdates = (entries) => {
  const byCanon = new Map();
  for (const entry of entries) {
    const canon = HISTORY_KEY_TO_CANON[entry.key];
    if (!canon || byCanon.has(canon)) continue;
    const field = RECORD_HISTORY_FIELDS.find((f) => f.key === canon);
    byCanon.set(canon, {
      key: canon,
      kind: field?.kind ?? "text",
      isDiff: entry.isDiff,
      old: entry.old,
      next: entry.next,
      value: entry.value,
    });
  }
  return VISIBLE_HISTORY_FIELDS.map((f) => byCanon.get(f.key)).filter(Boolean);
};

const paymentTypeLabel = (value) => {
  if (value === "payment") return "খোরাকি";
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

const summarizeRecordLog = (log, billingNameFn) => {
  if (!log) return "—";
  const fields = snapshotFields(log.changes);
  const bits = [];
  if (fields.present != null && fields.present !== "") {
    bits.push(formatHajiraLogValue("present", fields.present, billingNameFn));
  }
  const extra = fields.extra_earn ?? fields.extra;
  if (extra != null && Number(extra) > 0) {
    bits.push(`বাড়তি কাজ ${formatHajiraLogValue("extra", extra, billingNameFn)}`);
  }
  const payment = fields.fooding_pay ?? fields.payment ?? fields.amount;
  const advance = fields.advance_pay ?? fields.advance;
  const ret = fields.return_amount ?? fields.return;
  if (payment != null && payment !== "") {
    bits.push(
      `খোরাকি ${formatHajiraLogValue("amount", payment, billingNameFn)}`,
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
  if (SHOW_BILLING && (fields.billing != null || fields.billing_id != null)) {
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

const HistoryBiboron = ({ log, billingNameFn, summarize }) => {
  if (!log) return "—";
  if (log.action === "updated") {
    const entries = visibleFieldItems(
      activityChangeEntries(log.changes).filter((e) => e.isDiff),
    );
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
        কোনো অডিট হিস্ট্রি নেই।
      </p>
    );
  }

  const renderHistoryValue = (row) => {
    if (row.isDiff) {
      return (
        <ChangePair
          oldText={formatHajiraLogValue(row.key, row.old, billingNameFn)}
          newText={formatHajiraLogValue(row.key, row.next, billingNameFn)}
          newClassName={row.kind === "number" ? "tabular-nums" : ""}
        />
      );
    }
    return formatHajiraLogValue(row.key, row.value, billingNameFn);
  };

  const renderHistoryRows = (rows) => {
    const numberRows = rows.filter((row) => row.kind === "number");
    const textRows = rows.filter((row) => row.kind !== "number");
    return (
      <>
        {numberRows.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {numberRows.map((row) => (
              <div key={row.key} className="flex gap-1.5 min-w-0">
                <span className="w-14 shrink-0 text-base-content/60">
                  {fieldLabels[row.key] ?? row.key}
                </span>
                <span className="min-w-0 tabular-nums">
                  {renderHistoryValue(row)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {textRows.length ? (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {textRows.map((row) => (
              <div key={row.key} className="flex gap-1.5">
                <span className="w-14 shrink-0 text-base-content/60">
                  {fieldLabels[row.key] ?? row.key}
                </span>
                <span className="min-w-0">{renderHistoryValue(row)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  };

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
          const updateRows = historyRowsFromUpdates(logChanges);
          const snapshotRows = historyRowsFromSnapshot(fields);
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
                    <div className="text-xs leading-snug">
                      {log.action === "updated" ? (
                        updateRows.length ? (
                          renderHistoryRows(updateRows)
                        ) : (
                          <p className="text-base-content/50">
                            কোনো পরিবর্তন নেই।
                          </p>
                        )
                      ) : (
                        renderHistoryRows(snapshotRows)
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

/** Previous (struck) + current value for update diffs in history. */
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

const numOrEmpty = (value) => {
  if (value === "" || value == null) return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
};

const hasPresent = (row) => row.present !== "" && row.present != null;

const hasExtra = (row) => row.extra !== "" && row.extra != null;

const hasBilling = (row) => row.billing !== "" && row.billing != null;

const amountPositive = (value) => {
  if (value === "" || value == null) return false;
  return Number(value) > 0;
};

/** Backend: at least one of present/extra/fooding/advance/return must be non-zero. */
const hasMeaningfulDayValue = (row) =>
  (hasPresent(row) && Number(row.present) > 0) ||
  amountPositive(row.extra) ||
  amountPositive(row.payment) ||
  amountPositive(row.advance) ||
  amountPositive(row.return);

const lacksMeaningfulDayValue = (row) => !hasMeaningfulDayValue(row);

const MEANINGFUL_DAY_VALUE_MESSAGE =
  "হাজিরা, বাড়তি কাজ, খোরাকি, অ্যাডভান্স বা রিটার্নের অন্তত একটি মান ০-এর বেশি দিন।";

const presentEarnings = (row) => {
  if (!hasPresent(row) || Number(row.present) === 0) return 0;
  const salary =
    row.salary === "" || row.salary == null ? 0 : Number(row.salary);
  return Number(row.present) * salary;
};

const dayEarnings = (row, selected = ["from_present", "from_extra"]) => {
  const fields = Array.isArray(selected)
    ? selected
    : ["from_present", "from_extra"];
  let total = 0;
  if (fields.includes("from_present")) total += presentEarnings(row);
  if (fields.includes("from_extra")) {
    total += amountPositive(row.extra) ? Number(row.extra) : 0;
  }
  return total;
};

const hajiraTotalValue = (row, hajiraFilter = "hajira") => {
  if (hajiraFilter === "salary") {
    return row.salary !== "" && row.salary != null ? Number(row.salary) || 0 : 0;
  }
  if (hajiraFilter === "extra") {
    return row.extra !== "" && row.extra != null ? Number(row.extra) || 0 : 0;
  }
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
    row.salary != null &&
    hasPresent(row) &&
    Number(row.present) !== 0
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

/** Billing only when at least one meaningful day value exists. */
const canSetBillingOnRow = (row) => hasMeaningfulDayValue(row);

const isAttendanceDirty = (row, initial) =>
  String(row.present) !== String(initial.present) ||
  String(row.salary) !== String(initial.salary) ||
  String(row.extra ?? "") !== String(initial.extra ?? "") ||
  String(row.extraNote ?? "") !== String(initial.extraNote ?? "") ||
  String(row.billing ?? "") !== String(initial.billing ?? "");

const amountKey = (value) =>
  value === "" || value == null ? "" : String(Number(value));

/** Present dropdown shows 0 for unset rows, so 0 and empty compare equal. */
const presentKey = (value) =>
  value === "" || value == null || Number(value) === 0 ? "0" : String(Number(value));

const recordModalFromRow = (row) => ({
  labourId: row.labourId,
  labourName: row.labourName,
  labourPhoto: row.labourPhoto,
  present:
    row.present === "" || row.present == null ? "0" : String(row.present),
  salary:
    row.present === "" || row.present == null || Number(row.present) === 0
      ? ""
      : row.salary,
  extra: row.extra === "" || row.extra == null ? "" : row.extra,
  note: row.extraNote ?? "",
  billing: row.billing ?? "",
  billingName: row.billingName ?? null,
  payment: row.payment,
  advance: row.advance,
  return: row.return,
  recordId: row.recordId ?? row.attendanceId ?? null,
  recordSealed: row.recordSealed ?? row.attendanceSealed,
  attendanceSealed: row.attendanceSealed,
  attendanceId: row.attendanceId,
  attendanceDiffs: row.attendanceDiffs ?? null,
  paymentSealed: row.paymentSealed,
  paymentId: row.paymentId,
  paymentDiffs: row.paymentDiffs ?? null,
  advanceSealed: row.advanceSealed,
  advanceId: row.advanceId,
  returnSealed: row.returnSealed,
  returnId: row.returnId,
  returnDiffs: row.returnDiffs ?? null,
});

const isRecordModalDirty = (modal, row) => {
  if (!modal || !row) return false;
  const baseline = recordModalFromRow(row);
  return (
    presentKey(modal.present) !== presentKey(baseline.present) ||
    amountKey(modal.salary) !== amountKey(baseline.salary) ||
    amountKey(modal.extra) !== amountKey(baseline.extra) ||
    String(modal.note ?? "") !== String(baseline.note ?? "") ||
    String(modal.billing ?? "") !== String(baseline.billing ?? "") ||
    amountKey(modal.payment) !== amountKey(baseline.payment) ||
    amountKey(modal.advance) !== amountKey(baseline.advance) ||
    amountKey(modal.return) !== amountKey(baseline.return)
  );
};

const isPaymentDirty = (row, initial, key) =>
  String(row[key] ?? "") !== String(initial[key] ?? "") ||
  String(row[`${key}Note`] ?? "") !== String(initial[`${key}Note`] ?? "");

const hasAttendanceData = (row) =>
  hasMeaningfulDayValue(row) ||
  Boolean(row.extraNote?.trim()) ||
  Boolean(row.billing) ||
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

const RECORD_MODAL_ID = "hajira_record_modal";
const LABOUR_FILTER_MODAL_ID = "hajira_labour_filter_modal";
const EARNINGS_FILTER_MODAL_ID = "hajira_earnings_filter_modal";
const PAYMENT_FILTER_MODAL_ID = "hajira_payment_filter_modal";
const HAJIRA_FILTER_MODAL_ID = "hajira_hajira_filter_modal";
const BILLING_FILTER_MODAL_ID = "hajira_billing_filter_modal";

const emptyBulkAttendance = () => ({
  present: "0",
  salary: "",
});

const emptyBulkPayment = () => ({
  payment: "",
});

const emptyBulkBilling = () => ({
  billing: "none",
});

const isBulkAttendanceDirty = (form) =>
  String(form.present) !== "0" ||
  (form.salary !== "" && form.salary != null);

const isBulkPaymentDirty = (form) =>
  form.payment !== "" && form.payment != null;

const isBulkBillingDirty = (form) =>
  form.billing !== "" && form.billing != null;

const isBulkAttendanceZeroInvalid = (form) => {
  if (form.present === "" || form.present == null) return false;
  return Number(form.present) === 0;
};

const HAJIRA_FILTER_OPTIONS = [
  { value: "present", label: "উপস্থিতি" },
  { value: "salary", label: "বেতন" },
  { value: "extra", label: "বাড়তি কাজ" },
];

const HAJIRA_DEFAULT_FIELDS = ["present", "extra"];

const LABOUR_FILTER_OPTIONS = [
  { value: "record", label: "এই সাইটের রেকর্ড" },
  { value: "labour", label: "শুধু এই সাইটের শ্রমিক" },
];

const LABOUR_DEFAULT_FIELDS = ["record", "labour"];

const EARNINGS_FILTER_OPTIONS = [
  { value: "from_present", label: "বেতন থেকে আয়" },
  { value: "from_extra", label: "বাড়তি কাজ থেকে আয়" },
];

const EARNINGS_DEFAULT_FIELDS = EARNINGS_FILTER_OPTIONS.map((opt) => opt.value);

const PAYMENT_FILTER_OPTIONS = [
  { value: "payment", label: "খোরাকি" },
  { value: "advance", label: "অ্যাডভান্স" },
  { value: "return", label: "রিটার্ন" },
];

const PAYMENT_DEFAULT_FIELDS = PAYMENT_FILTER_OPTIONS.map((opt) => opt.value);

const filterHeaderTitle = (title, selected, required) =>
  required.every((value) => selected.includes(value)) ? title : `${title}*`;

const labourFilterNeedsActiveLabour = (filter) =>
  Array.isArray(filter) && filter.includes("labour");

const displayModalValue = (value) => {
  if (value === "" || value == null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? formatBnNumber(n) : String(value);
};

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
      "কিছু অডিট করা যায়নি।";
    if (!missingIds.length) return String(main);
    return `${main} (missing: ${missingIds.join(", ")})`;
  }

  return parsed?.message || messageForCode("error");
};

/** Bulk create attrs like `0.date` → per-row map + leftover general errors. */
const BULK_CREATE_FIELD_LABELS = {
  date: "তারিখ",
  labour: "শ্রমিক",
  present: "হাজিরা",
  wage: "বেতন",
  extra_earn: "বাড়তি কাজ",
  fooding_pay: "খোরাকি",
  advance_pay: "অ্যাডভান্স",
  return_amount: "রিটার্ন",
  note: "নোট",
  billing: "বিলিং",
};

const BULK_ROW_FIX_TOAST =
  "নিচের সমস্যাগুলো ঠিক করে আবার চেষ্টা করুন।";

const formatBulkDailyRecordCreateError = (parsed, createItems = []) => {
  const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
  const rowErrors = {};
  const generalErrors = [];

  for (const err of errors) {
    const match = String(err.attr ?? "").match(/^(\d+)(?:\.(.+))?$/);
    const detail = err.detail || messageForCode(err.code);

    if (!match) {
      generalErrors.push({ ...err, detail });
      continue;
    }

    const index = Number(match[1]);
    const field = match[2] || null;
    const item = createItems[index];
    if (!item) {
      generalErrors.push({ ...err, detail });
      continue;
    }

    const fieldLabel = field
      ? (BULK_CREATE_FIELD_LABELS[field] ?? field)
      : null;
    const rowDetail = fieldLabel ? `${fieldLabel}: ${detail}` : detail;
    const id = Number(item.labourId);
    if (!Number.isFinite(id)) {
      generalErrors.push({ ...err, detail: rowDetail });
      continue;
    }
    if (!rowErrors[id]) rowErrors[id] = [];
    if (!rowErrors[id].includes(rowDetail)) rowErrors[id].push(rowDetail);
  }

  return {
    rowErrors,
    generalErrors,
    hasRowErrors: Object.keys(rowErrors).length > 0,
  };
};

const PAYMENT_SPECS = [
  {
    key: "payment",
    noteKey: "paymentNote",
    idKey: "paymentId",
    sealedKey: "paymentSealed",
    type: "payment",
    label: "খোরাকি",
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
  const { date: selectedDate, siteId: selectedSiteId } = useOutletContext();
  const { can, profile, isCompanyAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const canAddDailyRecord = can(PERMS.addDailyRecord);
  const canChangeDailyRecord = can(PERMS.changeDailyRecord);
  const canDeleteDailyRecord = can(PERMS.deleteDailyRecord);
  const canViewLabour = can(PERMS.viewLabour);
  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, "view_activitylog");
  const canChangeActivityLog =
    can(PERMS.changeActivityLog) ||
    hasPermissionSuffix(profile, "change_activitylog");

  const allowedSiteIds = useMemo(
    () => new Set(profileAllowedSiteIds(profile).map(String)),
    [profile],
  );

  const canOpenLabourDetail = (row) => {
    if (!canViewLabour || row?.labourId == null) return false;
    if (row.labourCurrentSite == null || row.labourCurrentSite === "") {
      return false;
    }
    return allowedSiteIds.has(String(row.labourCurrentSite));
  };

  const siteId = selectedSiteId || readSelectedSite();
  const date = selectedDate || readSelectedDate() || todayIso();

  const [rows, setRows] = useState([]);
  const [initialRows, setInitialRows] = useState([]);
  const [apiError, setApiError] = useState(null);
  const [saveRowErrors, setSaveRowErrors] = useState({});
  const pendingCreateItemsRef = useRef([]);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [recordModal, setRecordModal] = useState(null);
  const [recordModalView, setRecordModalView] = useState(MODAL_VIEWS.detail);
  const [modalEditing, setModalEditing] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [labourFilter, setLabourFilter] = useState(() => [
    ...LABOUR_DEFAULT_FIELDS,
  ]);
  const [earningsFilter, setEarningsFilter] = useState(() => [
    ...EARNINGS_DEFAULT_FIELDS,
  ]);
  const [paymentFilter, setPaymentFilter] = useState([
    "payment",
    "advance",
    "return",
  ]);
  const [billingFilter, setBillingFilter] = useState(["all"]);
  const [hajiraFilter, setHajiraFilter] = useState([
    "present",
    "extra",
  ]);
  const [bulkAttendance, setBulkAttendance] = useState(emptyBulkAttendance);
  const [bulkPayment, setBulkPayment] = useState(emptyBulkPayment);
  const [bulkBilling, setBulkBilling] = useState(emptyBulkBilling);

  const showAyColumn = Boolean(isCompanyAdmin);

  const dailyRecordsQuery = useQuery({
    queryKey: ["sites", siteId, "daily-records", { date }],
    queryFn: async () => {
      const { data } = await fetchSiteDailyRecordsByDate(siteId, date);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId && date),
  });

  const billingLookup = useBillingLookup(siteId, { enabled: Boolean(siteId) });
  const billingOptions = billingLookup.activeCategories;
  const getBillingName = billingLookup.getBillingName;

  const activeLabourQuery = useQuery({
    queryKey: ["labours", "active", { current_site: siteId }],
    queryFn: async () => {
      const { data } = await fetchSiteActiveLabour(siteId);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId),
  });

  const selectedRecordId = recordIdOf(recordModal);

  /** Full audit log for the open record — fetched only on the history tab. */
  const entityHistoryQuery = useQuery({
    queryKey: [
      "activities",
      "entity",
      {
        site: siteId,
        entity_type: "daily_record",
        entity_id: selectedRecordId,
      },
    ],
    queryFn: () =>
      fetchAllActivities({
        site: siteId,
        entity_type: "daily_record",
        entity_id: selectedRecordId,
        page_size: 100,
      }),
    enabled: Boolean(
      canViewActivityLog &&
        recordModalView === MODAL_VIEWS.history &&
        selectedRecordId != null &&
        siteId,
    ),
  });

  const activityIdsForRow = (row) =>
    (row?.activityLogs ?? row?.pending_activities ?? [])
      .map((log) => Number(log.id))
      .filter((id) => Number.isFinite(id));

  const canShowRecordHistory = Boolean(selectedRecordId);

  const sortLogsDesc = (logs) =>
    [...logs].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

  const recordHistoryLogs = useMemo(
    () => sortLogsDesc(entityHistoryQuery.data ?? []),
    [entityHistoryQuery.data],
  );

  /** Resolve billing name from session lookup (API no longer embeds billing_name). */
  const billingFullLabelForRow = (rowOrId, maybeName) => {
    if (rowOrId != null && typeof rowOrId === "object") {
      const row = rowOrId;
      if (row.billing == null || row.billing === "") return NULL_BILLING_LABEL;
      if (row.billingName) return row.billingName;
      return getBillingName(row.billing);
    }
    const id = rowOrId;
    if (id == null || id === "") return NULL_BILLING_LABEL;
    if (maybeName) return maybeName;
    return getBillingName(id);
  };

  const billingLabelForRow = (row) =>
    concatBillingName(billingFullLabelForRow(row));

  const billingFullLabel = (id, name) => billingFullLabelForRow(id, name);

  const billingLabel = (id, name) =>
    concatBillingName(billingFullLabel(id, name));

  const billingFilterOptions = useMemo(() => {
    const options = [
      { value: "all", label: "সব" },
      { value: "none", label: NULL_BILLING_LABEL },
    ];
    const seen = new Set();
    for (const row of rows) {
      if (row.billing == null || row.billing === "") continue;
      const value = String(row.billing);
      if (seen.has(value)) continue;
      seen.add(value);
      options.push({
        value,
        label: row.billingName || getBillingName(value),
      });
    }
    return options;
  }, [rows, getBillingName]);

  const billingFilterHeaderLabel = (() => {
    if (
      !Array.isArray(billingFilter) ||
      billingFilter.length === 0 ||
      billingFilter.includes("all")
    ) {
      return "বিলিং";
    }
    if (billingFilter.length === 1) {
      const only = billingFilter[0];
      if (only === "none") return NULL_BILLING_LABEL;
      return billingLabel(
        only,
        billingFilterOptions.find((o) => o.value === only)?.label,
      );
    }
    return "বিলিং";
  })();

  const toggleBillingFilter = (value) => {
    setBillingFilter((prev) => {
      const current = Array.isArray(prev) ? prev : ["all"];
      if (value === "all") return ["all"];
      const withoutAll = current.filter((v) => v !== "all");
      if (withoutAll.includes(value)) {
        const next = withoutAll.filter((v) => v !== value);
        return next.length ? next : ["all"];
      }
      return [...withoutAll, value];
    });
  };

  const openHajiraModal = () => {
    setBulkAttendance(emptyBulkAttendance());
    document.getElementById(HAJIRA_FILTER_MODAL_ID)?.showModal();
  };

  const openPaymentModal = () => {
    setBulkPayment(emptyBulkPayment());
    document.getElementById(PAYMENT_FILTER_MODAL_ID)?.showModal();
  };

  const openBillingModal = () => {
    setBulkBilling(emptyBulkBilling());
    document.getElementById(BILLING_FILTER_MODAL_ID)?.showModal();
  };

  const openLabourFilterModal = () => {
    document.getElementById(LABOUR_FILTER_MODAL_ID)?.showModal();
  };

  const openEarningsFilterModal = () => {
    document.getElementById(EARNINGS_FILTER_MODAL_ID)?.showModal();
  };

  const withSiteLabourCurrentSite = (list) =>
    list.map((row) => ({
      ...row,
      labourCurrentSite:
        row.labourCurrentSite != null
          ? row.labourCurrentSite
          : siteId != null && siteId !== ""
            ? Number(siteId)
            : null,
    }));

  const buildRowsForLabourFilter = (filter) => {
    const selected = Array.isArray(filter) ? filter : LABOUR_DEFAULT_FIELDS;
    const includeRecord = selected.includes("record");
    const includeLabour = selected.includes("labour");
    const records = dailyRecordsQuery.data ?? [];
    const activeLabour = activeLabourQuery.data ?? [];

    if (!includeRecord && !includeLabour) return [];

    if (includeRecord && !includeLabour) {
      let next = buildHajiraViewRows(records);
      if (canViewActivityLog) {
        next = applyPendingActivitiesToHajiraRows(next);
      }
      return next;
    }

    if (includeLabour && !includeRecord) {
      let next = withSiteLabourCurrentSite(
        buildHajiraEditRows(activeLabour, records),
      );
      if (canViewActivityLog) {
        next = applyPendingActivitiesToHajiraRows(next);
      }
      return next;
    }

    const siteRows = withSiteLabourCurrentSite(
      buildHajiraEditRows(activeLabour, records),
    );
    const siteLabourIds = new Set(siteRows.map((row) => Number(row.labourId)));
    const otherRows = buildHajiraViewRows(records).filter(
      (row) => !siteLabourIds.has(Number(row.labourId)),
    );
    let next = [...siteRows, ...otherRows];
    if (canViewActivityLog) {
      next = applyPendingActivitiesToHajiraRows(next);
    }
    return next;
  };

  // Reset filters/select when site/date changes (not on first mount / refresh).
  const skipSiteDateResetRef = useRef(true);
  useEffect(() => {
    if (skipSiteDateResetRef.current) {
      skipSiteDateResetRef.current = false;
      return;
    }
    setLabourFilter([...LABOUR_DEFAULT_FIELDS]);
    setSelectMode(false);
    setSelectedIds(new Set());
    setApiError(null);
    setSaveRowErrors({});
    setRecordModal(null);
    setRecordModalView(MODAL_VIEWS.detail);
    setModalEditing(false);
    setExpandedHistoryId(null);
    setEarningsFilter([...EARNINGS_DEFAULT_FIELDS]);
    setPaymentFilter(["payment", "advance", "return"]);
    setBillingFilter(["all"]);
    setHajiraFilter(["present", "extra"]);
  }, [siteId, date]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSaveRowErrors({});
  }, [earningsFilter, paymentFilter, billingFilter, hajiraFilter, labourFilter]);

  // Single-mode row rebuild for current labour filter.
  useEffect(() => {
    if (!dailyRecordsQuery.isSuccess) return;
    if (
      labourFilterNeedsActiveLabour(labourFilter) &&
      !activeLabourQuery.isSuccess
    ) {
      return;
    }
    const next = buildRowsForLabourFilter(labourFilter);
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  }, [
    labourFilter,
    canViewActivityLog,
    dailyRecordsQuery.isSuccess,
    dailyRecordsQuery.data,
    activeLabourQuery.isSuccess,
    activeLabourQuery.data,
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

  const viewEarningsFilter = earningsFilter;
  const viewPaymentFilter = paymentFilter;
  const viewBillingFilter = SHOW_BILLING ? billingFilter : ["all"];
  const viewHajiraFields = hajiraFilter.filter((field) => field !== "billing");
  const viewHajiraFilter = viewHajiraFields.includes("present")
    ? "present"
    : viewHajiraFields.includes("salary")
      ? "salary"
      : viewHajiraFields.includes("extra")
        ? "extra"
        : "present";

  const visibleRows = useMemo(() => {
    const selected = Array.isArray(viewBillingFilter)
      ? viewBillingFilter
      : [viewBillingFilter];
    if (selected.length === 0 || selected.includes("all")) return rows;
    return rows.filter((row) => {
      const isNone = row.billing == null || row.billing === "";
      if (isNone) return selected.includes("none");
      return selected.some((v) => String(v) === String(row.billing));
    });
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

  const showReturnAmount = (row) =>
    viewPaymentFilter.includes("return") && hasAmount(row.return);

  const attendanceLocked = (row) =>
    recordSealedOf(row) ||
    (recordIdOf(row) ? !canChangeDailyRecord : !canAddDailyRecord);

  const isCreateModal = Boolean(recordModal && !recordIdOf(recordModal));
  const modalEditable = Boolean(
    recordModal &&
      !recordSealedOf(recordModal) &&
      (isCreateModal
        ? canAddDailyRecord
        : modalEditing && canChangeDailyRecord),
  );

  const canUpdateRecord = Boolean(
    recordModal &&
      recordIdOf(recordModal) &&
      !recordSealedOf(recordModal) &&
      canChangeDailyRecord,
  );
  const canDeleteRecord = Boolean(
    recordModal &&
      recordIdOf(recordModal) &&
      !recordSealedOf(recordModal) &&
      canDeleteDailyRecord,
  );

  const resetModalEditState = () => {
    setModalEditing(false);
  };

  const closeRecordModal = () => {
    document.getElementById(RECORD_MODAL_ID)?.close();
    setRecordModal(null);
    setRecordModalView(MODAL_VIEWS.detail);
    setExpandedHistoryId(null);
    resetModalEditState();
  };

  const openRecordModal = (row) => {
    setRecordModalView(MODAL_VIEWS.detail);
    setExpandedHistoryId(null);
    resetModalEditState();
    setRecordModal(recordModalFromRow(row));
    document.getElementById(RECORD_MODAL_ID)?.showModal();
  };

  const startModalEdit = () => {
    if (!canUpdateRecord || !recordModal) return;
    setRecordModalView(MODAL_VIEWS.detail);
    setModalEditing(true);
  };

  const saveRecordModal = () => {
    if (!recordModal || !modalEditable || attendanceLocked(recordModal)) return;
    const currentRow = rows.find((r) => r.labourId === recordModal.labourId);
    if (!isRecordModalDirty(recordModal, currentRow)) return;
    const presentEmpty =
      recordModal.present === "" ||
      recordModal.present == null ||
      Number(recordModal.present) === 0;
    const presentNum = presentEmpty ? 0 : Number(recordModal.present);
    const billingAllowed = canSetBillingOnRow(recordModal);
    const next = {
      present: isCreateModal && presentEmpty ? "" : presentNum,
      salary: presentEmpty ? "" : numOrEmpty(recordModal.salary),
      extra:
        recordModal.extra === "" || recordModal.extra == null
          ? ""
          : Number(recordModal.extra),
      extraNote: recordModal.note ?? "",
      billing: billingAllowed ? (recordModal.billing ?? "") : "",
      billingName: billingAllowed
        ? recordModal.billing == null || recordModal.billing === ""
          ? null
          : (recordModal.billingName ?? null)
        : null,
      payment: numOrEmpty(recordModal.payment),
      advance: numOrEmpty(recordModal.advance),
      return: numOrEmpty(recordModal.return),
      paymentNote: "",
      advanceNote: "",
      returnNote: "",
    };
    // New rows can be cleared back to unset; saved records still need a day value.
    if (!isCreateModal && lacksMeaningfulDayValue(next)) return;
    updateRow(recordModal.labourId, next);
    closeRecordModal();
  };

  const onDeleteRecord = async () => {
    if (!canDeleteRecord || !recordModal) return;
    const recordId = recordIdOf(recordModal);
    if (recordId == null) return;
    const confirmed = await confirmAction({
      title: "রেকর্ড মুছে ফেলবেন?",
      text: "এই কাজটি ফিরিয়ে আনা যাবে না।",
      confirmText: "ডিলিট করুন",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteLabourDailyRecord(recordModal.labourId, recordId);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sites", siteId, "daily-records"],
        }),
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
      ]);
      toastSuccess("রেকর্ড ডিলিট হয়েছে");
      closeRecordModal();
    } catch (err) {
      toastApiError(parseApiError(err));
    }
  };

  const resetRecordModal = () => {
    if (!recordModal) return;
    const initial = initialByLabour.get(recordModal.labourId);
    if (!initial) return;
    const resetForm = recordModalFromRow(initial);
    setRecordModal({
      ...recordModal,
      present: resetForm.present,
      salary: resetForm.salary,
      extra: resetForm.extra,
      note: resetForm.note,
      billing: resetForm.billing,
      billingName: resetForm.billingName,
      payment: resetForm.payment,
      advance: resetForm.advance,
      return: resetForm.return,
    });
  };

  const applyRecordModalDefaults = () => {
    if (!recordModal || !modalEditable || attendanceLocked(recordModal)) return;
    const row = rows.find((r) => r.labourId === recordModal.labourId);
    if (!row) return;
    setRecordModal((m) => {
      if (!m) return m;
      const blank = (value) => value === "" || value == null;
      const unsetPresent = blank(m.present) || Number(m.present) === 0;
      const present = unsetPresent
        ? row.defaultAttendance === "" || row.defaultAttendance == null
          ? ""
          : String(row.defaultAttendance)
        : m.present;
      const salary = blank(m.salary) ? row.defaultSalary : m.salary;
      const payment = blank(m.payment) ? row.defaultFooding : m.payment;
      return { ...m, present, salary, payment };
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
      text: `${formatBnNumber(ids.length)}টি হাজিরা অডিট হবে। পরে বাতিল করা যাবে না।`,
      confirmText: "অডিট করুন",
      cancelText: "বাতিল",
    });
    if (!ok) return;

    setReviewing(true);
    setApiError(null);
    try {
      await reviewActivities(ids);
      exitSelectMode();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sites", siteId, "daily-records"],
        }),
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
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

  /** Bulk fills blank fields on unlocked rows (create or change). */
  const isBulkTargetRow = (row) => !attendanceLocked(row);

  const showBulkSection = canAddDailyRecord || canChangeDailyRecord;

  const isBlank = (value) => value === "" || value == null;
  /** Extra defaults to 0 on rows — treat 0 as unset for bulk fill. */
  const isUnsetExtra = (value) => isBlank(value) || Number(value) === 0;

  const applyAttendanceDefaults = () => {
    setRows((prev) =>
      prev.map((row) => {
        if (!isBulkTargetRow(row)) return row;
        const present = isBlank(row.present)
          ? row.defaultAttendance
          : row.present;
        const salary =
          Number(present) === 0
            ? ""
            : isBlank(row.salary)
              ? row.defaultSalary
              : row.salary;
        return {
          ...row,
          present,
          salary,
        };
      }),
    );
  };

  const applyPaymentDefaults = () => {
    setRows((prev) =>
      prev.map((row) => {
        if (!isBulkTargetRow(row)) return row;
        return {
          ...row,
          payment: isBlank(row.payment) ? row.defaultFooding : row.payment,
        };
      }),
    );
  };

  const onHajiraBulkDefault = () => {
    applyAttendanceDefaults();
    document.getElementById(HAJIRA_FILTER_MODAL_ID)?.close();
  };

  const onHajiraBulkCustom = () => {
    if (!isBulkAttendanceDirty(bulkAttendance)) return;
    if (isBulkAttendanceZeroInvalid(bulkAttendance)) {
      toastInfo(MEANINGFUL_DAY_VALUE_MESSAGE);
      return;
    }

    const customWouldBeInvalid = rows.some((row) => {
      if (!isBulkTargetRow(row)) return false;
      const next = {
        present:
          bulkAttendance.present !== "" && isBlank(row.present)
            ? Number(bulkAttendance.present)
            : row.present,
        extra: row.extra,
        payment: row.payment,
        advance: row.advance,
        return: row.return,
      };
      return lacksMeaningfulDayValue(next);
    });
    if (customWouldBeInvalid) {
      toastInfo(MEANINGFUL_DAY_VALUE_MESSAGE);
      return;
    }

    setRows((prev) =>
      prev.map((row) => {
        if (!isBulkTargetRow(row)) return row;

        const applyingPresent =
          bulkAttendance.present !== "" && isBlank(row.present);
        const nextPresent = applyingPresent
          ? Number(bulkAttendance.present)
          : row.present;

        let nextSalary = row.salary;
        if (Number(nextPresent) === 0) {
          nextSalary = "";
        } else if (
          bulkAttendance.salary !== "" &&
          bulkAttendance.salary != null &&
          isBlank(row.salary)
        ) {
          nextSalary = Number(bulkAttendance.salary);
        } else if (
          applyingPresent &&
          isBlank(row.salary) &&
          (bulkAttendance.salary === "" || bulkAttendance.salary == null) &&
          !isBlank(row.defaultSalary)
        ) {
          nextSalary = Number(row.defaultSalary);
        }

        return {
          ...row,
          present: nextPresent,
          salary: nextSalary,
        };
      }),
    );
    document.getElementById(HAJIRA_FILTER_MODAL_ID)?.close();
  };

  const onPaymentBulkDefault = () => {
    applyPaymentDefaults();
    document.getElementById(PAYMENT_FILTER_MODAL_ID)?.close();
  };

  const onPaymentBulkCustom = () => {
    if (!isBulkPaymentDirty(bulkPayment)) return;
    setRows((prev) =>
      prev.map((row) => {
        if (!isBulkTargetRow(row)) return row;
        return {
          ...row,
          payment:
            bulkPayment.payment !== "" &&
            bulkPayment.payment != null &&
            isBlank(row.payment)
              ? Number(bulkPayment.payment)
              : row.payment,
        };
      }),
    );
    document.getElementById(PAYMENT_FILTER_MODAL_ID)?.close();
  };

  const onBillingBulkCustom = (billingValue = bulkBilling.billing) => {
    if (billingValue === "" || billingValue == null) return;
    const selectedId = billingValue === "none" ? null : billingValue;
    const selectedName =
      selectedId == null || selectedId === ""
        ? null
        : getBillingName(selectedId);
    const nextBilling =
      selectedId == null || selectedId === "" ? "" : String(selectedId);

    setRows((prev) =>
      prev.map((row) => {
        if (!isBulkTargetRow(row)) return row;
        // Only brand-new rows (no saved record yet)
        if (recordIdOf(row)) return row;
        if (!canSetBillingOnRow(row)) return row;
        if (!isBlank(row.billing)) return row;
        return {
          ...row,
          billing: nextBilling,
          billingName: selectedName,
        };
      }),
    );
    setBulkBilling({ billing: billingValue });
    document.getElementById(BILLING_FILTER_MODAL_ID)?.close();
  };

  const onHajiraBulkReset = () => {
    setRows((prev) =>
      prev.map((row) => {
        if (!isBulkTargetRow(row)) return row;
        const initial = initialByLabour.get(row.labourId);
        if (!initial) return row;
        return {
          ...row,
          present: initial.present,
          salary: initial.salary,
          extra: initial.extra,
        };
      }),
    );
    setBulkAttendance(emptyBulkAttendance());
    document.getElementById(HAJIRA_FILTER_MODAL_ID)?.close();
  };

  const onPaymentBulkReset = () => {
    setRows((prev) =>
      prev.map((row) => {
        if (!isBulkTargetRow(row)) return row;
        const initial = initialByLabour.get(row.labourId);
        if (!initial) return row;
        let next = row;
        for (const spec of PAYMENT_SPECS) {
          next = {
            ...next,
            [spec.key]: initial[spec.key],
          };
        }
        return next;
      }),
    );
    setBulkPayment(emptyBulkPayment());
    document.getElementById(PAYMENT_FILTER_MODAL_ID)?.close();
  };

  const onBillingBulkReset = () => {
    setRows((prev) =>
      prev.map((row) => {
        if (!isBulkTargetRow(row)) return row;
        const initial = initialByLabour.get(row.labourId);
        if (!initial) return row;
        return {
          ...row,
          billing: initial.billing,
          billingName: initial.billingName ?? null,
        };
      }),
    );
    setBulkBilling(emptyBulkBilling());
    document.getElementById(BILLING_FILTER_MODAL_ID)?.close();
  };

  const hasHajiraBulkReset =
    rows.some((row) => {
      if (!isBulkTargetRow(row)) return false;
      const initial = initialByLabour.get(row.labourId);
      if (!initial) return false;
      return (
        String(row.present) !== String(initial.present) ||
        String(row.salary) !== String(initial.salary) ||
        String(row.extra ?? "") !== String(initial.extra ?? "")
      );
    }) || isBulkAttendanceDirty(bulkAttendance);

  const hasPaymentBulkReset =
    rows.some((row) => {
      if (!isBulkTargetRow(row)) return false;
      const initial = initialByLabour.get(row.labourId);
      if (!initial) return false;
      return PAYMENT_SPECS.some(
        (spec) =>
          String(row[spec.key] ?? "") !== String(initial[spec.key] ?? ""),
      );
    }) || isBulkPaymentDirty(bulkPayment);

  const hasBillingBulkReset =
    rows.some((row) => {
      if (!isBulkTargetRow(row)) return false;
      const initial = initialByLabour.get(row.labourId);
      if (!initial) return false;
      return String(row.billing ?? "") !== String(initial.billing ?? "");
    }) || isBulkBillingDirty(bulkBilling);

  const onCancel = () => {
    setApiError(null);
    setSaveRowErrors({});
    const next = buildRowsForLabourFilter(labourFilter);
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const createItems = [];
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
          createItems.push({
            labourId: row.labourId,
            labourName: row.labourName,
            payload: toDailyRecordPayload(row, date),
          });
        }
      }

      pendingCreateItemsRef.current = createItems;
      if (createItems.length) {
        await createSiteDailyRecords(
          siteId,
          createItems.map((item) => item.payload),
        );
      }
      pendingCreateItemsRef.current = [];

      await Promise.all(
        updates.map((item) =>
          updateLabourDailyRecord(item.labourId, item.id, item.payload),
        ),
      );

      return {
        creates: createItems.length,
        updates: updates.length,
        blocked,
      };
    },
  });

  const onSave = async () => {
    setApiError(null);
    setSaveRowErrors({});
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
      return lacksMeaningfulDayValue(row);
    });
    if (invalidZero) {
      toastInfo(MEANINGFUL_DAY_VALUE_MESSAGE);
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sites", siteId, "daily-records"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["sites", siteId, "daily-reports"],
        }),
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
      ]);
      toastSuccess("হাজিরা ও পেমেন্ট সেভ হয়েছে");
    } catch (err) {
      const parsed = parseApiError(err);
      const createItems = pendingCreateItemsRef.current ?? [];
      pendingCreateItemsRef.current = [];

      if (createItems.length) {
        const { rowErrors, generalErrors, hasRowErrors } =
          formatBulkDailyRecordCreateError(parsed, createItems);

        if (hasRowErrors) {
          setSaveRowErrors(rowErrors);
          toastError(BULK_ROW_FIX_TOAST);
        }

        if (generalErrors.length) {
          await alertError({
            text: generalErrors.map((e) => e.detail).join(" "),
          });
        } else if (!hasRowErrors) {
          await alertError({ text: parsed.message });
        }
        return;
      }

      await alertError({ text: parsed.message });
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
    (labourFilterNeedsActiveLabour(labourFilter) &&
      activeLabourQuery.isLoading);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const loadError =
    dailyRecordsQuery.error ||
    (labourFilterNeedsActiveLabour(labourFilter)
      ? activeLabourQuery.error
      : null);
  if (loadError) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        <ApiErrorAlert error={parseApiError(loadError)} />
      </div>
    );
  }

  const includeLabourRows = labourFilter.includes("labour");
  const includeRecordRows = labourFilter.includes("record");
  const emptyMessage =
    !includeLabourRows && !includeRecordRows
      ? "কোনো ফিল্টার নির্বাচিত নেই।"
      : includeLabourRows && !includeRecordRows
        ? "এই সাইটে কোনো চালু শ্রমিক নেই।"
        : includeLabourRows && includeRecordRows
          ? "এই সাইটে কোনো চালু শ্রমিক নেই এবং অন্য কোনো রেকর্ড নেই।"
          : "এই তারিখে কোনো হাজিরা নেই।";

  const recordModalLocked = !modalEditable;
  const salaryFieldEnabled =
    Boolean(recordModal) &&
    !recordModalLocked &&
    hasPresent(recordModal) &&
    Number(recordModal.present) !== 0;
  const billingFieldEnabled =
    Boolean(recordModal) &&
    !recordModalLocked &&
    canSetBillingOnRow(recordModal);
  const recordModalBaselineRow = recordModal
    ? rows.find((r) => r.labourId === recordModal.labourId)
    : null;
  const recordModalDirty = isRecordModalDirty(
    recordModal,
    recordModalBaselineRow,
  );
  const recordModalCanSet =
    Boolean(recordModal) &&
    modalEditable &&
    !attendanceLocked(recordModal) &&
    recordModalDirty &&
    (isCreateModal || hasMeaningfulDayValue(recordModal));

  const tableColCount =
    4 + (showAyColumn ? 1 : 0) + (SHOW_BILLING ? 1 : 0);

  const patchRecordModal = (patch) => {
    setRecordModal((m) => {
      if (!m) return m;
      const next = { ...m, ...patch };
      if (!hasPresent(next) || Number(next.present) === 0) {
        next.salary = "";
      }
      if (!canSetBillingOnRow(next)) {
        next.billing = "";
        next.billingName = null;
      }
      return next;
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {apiError ? <ApiErrorAlert error={apiError} /> : null}

      <div className="flex-1 min-h-0 overflow-auto pb-24">
        <table className="table table-sm sm:table-md w-full">
          <thead className="sticky top-0 z-10 bg-base-100">
            <tr className="border-b border-base-300 text-sm">
              <th>
                {selectMode && canChangeActivityLog ? (
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
                ) : canChangeActivityLog ? (
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
              <th>
                <button
                  type="button"
                  onClick={openLabourFilterModal}
                >
                  {filterHeaderTitle("নাম", labourFilter, LABOUR_DEFAULT_FIELDS)}
                </button>
              </th>
              <th className="text-right">
                <button type="button" onClick={openHajiraModal}>
                  {filterHeaderTitle(
                    "হাজিরা",
                    hajiraFilter,
                    HAJIRA_DEFAULT_FIELDS,
                  )}
                </button>
              </th>
              {showAyColumn ? (
                <th className="text-right">
                  <button
                    type="button"
                    onClick={openEarningsFilterModal}
                  >
                    {filterHeaderTitle(
                      "আয়",
                      earningsFilter,
                      EARNINGS_DEFAULT_FIELDS,
                    )}
                  </button>
                </th>
              ) : null}
              <th className="text-right">
                <button type="button" onClick={openPaymentModal}>
                  {filterHeaderTitle(
                    "লেনদেন",
                    paymentFilter,
                    PAYMENT_DEFAULT_FIELDS,
                  )}
                </button>
              </th>
              {SHOW_BILLING ? (
                <th className="text-right">
                  <button type="button" onClick={openBillingModal}>
                    {billingFilterHeaderLabel}
                  </button>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColCount}
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
                const hajiraDirtyTone = fieldTone(
                  row,
                  initial,
                  ["present", "salary", "extra", "extraNote", "billing"],
                  "attendanceId",
                );
                const hajiraGroupTone =
                  hajiraDirtyTone !== "text-base-content/60"
                    ? hajiraDirtyTone
                    : activityTextToneClass(row.activityTone) ||
                      "text-base-content/70";
                const earn = dayEarnings(row, viewEarningsFilter);
                const paymentPart = viewPaymentFilter.includes("payment")
                  ? hasAmount(row.payment)
                    ? paymentAmountOf(row)
                    : null
                  : null;
                const advancePart = viewPaymentFilter.includes("advance")
                  ? hasAmount(row.advance)
                    ? advanceAmountOf(row)
                    : null
                  : null;
                const outflowParts = [paymentPart, advancePart].filter(
                  (v) => v != null,
                );
                const showOutflow = outflowParts.length > 0;
                const outflow = outflowParts.reduce((sum, n) => sum + n, 0);
                const showRet = showReturnAmount(row);
                const attendanceLines = attendanceCellLines(
                  row,
                  (id) => billingFullLabelForRow(row),
                  viewHajiraFields,
                );
                const rowToneClass = activityToneClass(row.activityTone);
                const rowSaveErrors =
                  saveRowErrors[Number(row.labourId)] ??
                  saveRowErrors[row.labourId] ??
                  null;
                const hasSaveError = Boolean(
                  rowSaveErrors && rowSaveErrors.length,
                );

                return (
                  <tr
                    key={row.labourId}
                    className={[
                      "border-b border-base-300/70 cursor-pointer",
                      hasSaveError ? "bg-error/10" : rowToneClass,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => openRecordModal(row)}
                  >
                    <td className="tabular-nums text-base-content/60">
                      {selectMode && canChangeActivityLog ? (
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={rowSelected}
                          disabled={!selectable}
                          aria-label={`নির্বাচন ${formatBnNumber(index + 1)}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            toggleRowSelected(row, e.target.checked)
                          }
                        />
                      ) : (
                        formatBnNumber(index + 1)
                      )}
                    </td>
                    <td
                      className="font-medium"
                      title={
                        hasSaveError
                          ? rowSaveErrors.join(" · ")
                          : row.labourName
                      }
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {row.labourId != null ? (
                            <Link
                              to={paths.labourDetail(row.labourId)}
                              className={[
                                "flex items-center gap-2 min-w-0",
                                canOpenLabourDetail(row)
                                  ? ""
                                  : "text-base-content/60 no-underline pointer-events-none",
                              ].join(" ")}
                              title={
                                canOpenLabourDetail(row)
                                  ? row.labourName
                                  : "এই শ্রমিকের সাইটে অনুমতি নেই"
                              }
                              aria-disabled={!canOpenLabourDetail(row)}
                              tabIndex={
                                canOpenLabourDetail(row) ? undefined : -1
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canOpenLabourDetail(row)) e.preventDefault();
                              }}
                            >
                              <PersonAvatar
                                photo={row.labourPhoto}
                                name={row.labourName}
                                size="xs"
                                shape="square"
                              />
                              <span
                                className={
                                  canOpenLabourDetail(row)
                                    ? "link link-hover"
                                    : ""
                                }
                              >
                                {concatLabourName(row.labourName)}
                              </span>
                            </Link>
                          ) : (
                            <>
                              <PersonAvatar
                                photo={row.labourPhoto}
                                name={row.labourName}
                                size="xs"
                                shape="square"
                              />
                              {concatLabourName(row.labourName)}
                            </>
                          )}
                        </div>
                        {hasSaveError ? (
                          <p className="text-xs text-error font-normal whitespace-normal leading-snug mt-0.5 max-w-48 sm:max-w-none">
                            {rowSaveErrors.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className={`text-right ${hajiraGroupTone}`}>
                      <span className="block w-full space-y-0.5 text-right leading-tight">
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
                    </td>
                    {showAyColumn ? (
                      <td
                        className={`text-right tabular-nums ${hajiraGroupTone}`}
                      >
                        {earn ? formatBnNumber(earn) : "—"}
                      </td>
                    ) : null}
                    <td className="text-right">
                      {showOutflow || showRet ? (
                        <span className="block w-full tabular-nums space-y-0.5 text-right leading-tight">
                          {showOutflow ? (
                            <span
                              className={`block w-full text-right ${paymentLineTone(
                                row,
                                initial,
                                [
                                  "payment",
                                  "paymentNote",
                                  "advance",
                                  "advanceNote",
                                ],
                                "paymentId",
                                "text-error",
                              )}`}
                            >
                              {formatBnNumber(outflow)}
                            </span>
                          ) : null}
                          {showRet ? (
                            <span
                              className={`block w-full text-right ${paymentLineTone(
                                row,
                                initial,
                                ["return", "returnNote"],
                                "returnId",
                                "text-success",
                              )}`}
                            >
                              {formatBnNumber(row.return)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="block w-full text-right text-base-content/60">
                          —
                        </span>
                      )}
                    </td>
                    {SHOW_BILLING ? (
                    <td
                      className="text-right text-sm whitespace-nowrap"
                      title={
                        hasBilling(row) || recordIdOf(row)
                          ? billingFullLabelForRow(row)
                          : undefined
                      }
                    >
                      {hasBilling(row) || recordIdOf(row)
                        ? billingLabelForRow(row)
                        : "—"}
                    </td>
                    ) : null}
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
                      {totals.payment || totals.advance ? (
                        <span className="block w-full text-right text-error">
                          {formatBnNumber(totals.payment + totals.advance)}
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
                {SHOW_BILLING ? (
                <td className="text-right text-base-content/60">—</td>
                ) : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {isDirty ? (
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
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8 shrink-0">
            {recordModal && canViewActivityLog && canShowRecordHistory ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={
                    recordModalView === MODAL_VIEWS.detail
                      ? "text-primary"
                      : "text-base-content/50 hover:text-base-content"
                  }
                  disabled={modalEditing}
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
                  disabled={modalEditing}
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
            canShowRecordHistory ? (
              <EntityHistoryPanel
                isLoading={entityHistoryQuery.isLoading}
                error={
                  entityHistoryQuery.isError ? entityHistoryQuery.error : null
                }
                logs={recordHistoryLogs}
                expandedId={expandedHistoryId}
                setExpandedId={setExpandedHistoryId}
                fieldLabels={RECORD_LOG_FIELD_LABELS}
                billingNameFn={billingFullLabel}
                summarize={summarizeRecordLog}
              />
            ) : recordModal ? (
              <div className="space-y-3">
                {modalEditable ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="form-control w-full min-w-0">
                        <span className="label-text text-sm">হাজিরা</span>
                        <select
                          className="select select-bordered select-sm w-full"
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
                        <span className="label-text text-sm">বেতন</span>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-full tabular-nums"
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
                        <span className="label-text text-sm">খোরাকি</span>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-full tabular-nums"
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

                    <div className="space-y-3 border-t border-dashed border-base-300 pt-3 opacity-50 hover:opacity-85 focus-within:opacity-100 transition-opacity [&_.label-text]:text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <label className="form-control w-full min-w-0">
                          <span className="label-text text-sm">বাড়তি কাজ</span>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full tabular-nums"
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
                          <span className="label-text text-sm">অ্যাডভান্স</span>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full tabular-nums"
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
                          <span className="label-text text-sm">রিটার্ন</span>
                          <input
                            type="number"
                            min={0}
                            className="input input-bordered input-sm w-full tabular-nums"
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
                        <span className="label-text text-sm">নোট</span>
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
                      <span className="label-text text-sm">বিলিং</span>
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
                                : (opt?.name ?? recordModal.billingName ?? null),
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

                    <div className="modal-action pt-1 flex-wrap justify-between gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={resetRecordModal}
                      >
                        রিসেট
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={applyRecordModalDefaults}
                        >
                          ডিফল্ট
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={saveRecordModal}
                          disabled={!recordModalCanSet}
                          title={
                            recordModalCanSet
                              ? undefined
                              : !recordModalDirty
                                ? "কোনো পরিবর্তন নেই।"
                                : MEANINGFUL_DAY_VALUE_MESSAGE
                          }
                        >
                          সেট করুন
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="form-control w-full min-w-0">
                        <span className="label-text text-sm">হাজিরা</span>
                        <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                          {recordModal.present === ""
                            ? "—"
                            : formatBnNumber(recordModal.present)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text text-sm">বেতন</span>
                        <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                          {displayModalValue(recordModal.salary)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text text-sm">খোরাকি</span>
                        <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                          {displayModalValue(recordModal.payment)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-dashed border-base-300 pt-3 opacity-50 [&_.label-text]:text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="form-control w-full min-w-0">
                          <span className="label-text text-sm">বাড়তি কাজ</span>
                          <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                            {displayModalValue(recordModal.extra)}
                          </div>
                        </div>
                        <div className="form-control w-full min-w-0">
                          <span className="label-text text-sm">অ্যাডভান্স</span>
                          <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                            {displayModalValue(recordModal.advance)}
                          </div>
                        </div>
                        <div className="form-control w-full min-w-0">
                          <span className="label-text text-sm">রিটার্ন</span>
                          <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                            {displayModalValue(recordModal.return)}
                          </div>
                        </div>
                      </div>
                      <div className="form-control w-full">
                        <span className="label-text text-sm">নোট</span>
                        <div className="min-h-8 flex items-center px-1 text-sm">
                          {recordModal.note?.trim() ? recordModal.note : "—"}
                        </div>
                      </div>
                    </div>
                    {SHOW_BILLING ? (
                    <div className="form-control w-full">
                      <span className="label-text text-sm">বিলিং</span>
                      <div className="min-h-8 flex items-center px-1 text-sm">
                        {billingFullLabelForRow(recordModal)}
                      </div>
                    </div>
                    ) : null}
                    {recordIdOf(recordModal) ? (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          className="btn btn-outline btn-primary btn-sm flex-1"
                          disabled={!canUpdateRecord}
                          title={
                            recordSealedOf(recordModal)
                              ? "রেকর্ড সিল করা আছে"
                              : !canChangeDailyRecord
                                ? "আপডেট অনুমতি নেই"
                                : undefined
                          }
                          onClick={startModalEdit}
                        >
                          <Pencil className="size-4" strokeWidth={1.75} />
                          আপডেট
                        </button>
                        <button
                          type="button"
                          className="btn btn-error btn-sm flex-1"
                          disabled={!canDeleteRecord}
                          title={
                            recordSealedOf(recordModal)
                              ? "রেকর্ড সিল করা আছে"
                              : !canDeleteDailyRecord
                                ? "ডিলিট অনুমতি নেই"
                                : undefined
                          }
                          onClick={onDeleteRecord}
                        >
                          <Trash2 className="size-4" strokeWidth={1.75} />
                          ডিলিট
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>

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
            <div className="flex flex-col gap-2">
              {LABOUR_FILTER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={labourFilter.includes(opt.value)}
                    onChange={() => {
                      setLabourFilter((prev) =>
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
                      disabled={Number(bulkAttendance.present) === 0}
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
            {showBulkSection ? (
              <div className="space-y-3 border-t border-base-300 pt-3">
                <label className="form-control w-full">
                  <span className="label-text text-sm">খোরাকি</span>
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
    </div>
  );
};
