import { Fragment } from "react";
import {
  activityTextToneClass,
  activityToneClass,
  snapshotFields,
} from "../api/types/activity.js";
import { parseApiError } from "../api/errors.js";
import { ApiErrorAlert } from "./ApiErrorAlert.jsx";
import { SHOW_BILLING, visibleFieldItems } from "../config/features.js";
import { formatBnNumber, NULL_BILLING_LABEL } from "../utils/format.js";
import { formatDateBn } from "../utils/dateRange.js";

export const RECORD_LOG_FIELD_LABELS = {
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

const RECORD_HISTORY_FIELDS = [
  { key: "present", aliases: ["present"], kind: "number" },
  { key: "salary", aliases: ["wage", "salary"], kind: "number" },
  { key: "extra", aliases: ["extra_earn", "extra"], kind: "number" },
  { key: "payment", aliases: ["fooding_pay", "payment"], kind: "number" },
  { key: "advance", aliases: ["advance_pay", "advance"], kind: "number" },
  { key: "return", aliases: ["return_amount", "return"], kind: "number" },
  { key: "date", aliases: ["date"], kind: "date" },
  { key: "note", aliases: ["note"], kind: "text" },
  { key: "billing", aliases: ["billing", "billing_id"], kind: "text" },
];

const VISIBLE_HISTORY_FIELDS = visibleFieldItems(RECORD_HISTORY_FIELDS);

const HISTORY_KEY_TO_CANON = Object.fromEntries(
  VISIBLE_HISTORY_FIELDS.flatMap((field) =>
    field.aliases.map((alias) => [alias, field.key]),
  ),
);

const sameDisplay = (a, b) => String(a ?? "") === String(b ?? "");

const paymentTypeLabel = (value) => {
  if (value === "payment") return "খোরাকি";
  if (value === "advance") return "অ্যাডভান্স";
  if (value === "return") return "রিটার্ন";
  return value == null || value === "" ? "—" : String(value);
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

const formatLogValue = (key, value, billingNameFn) => {
  if (value == null || value === "" || value === "None" || value === "null") {
    if (key === "billing" || key === "billing_id") return NULL_BILLING_LABEL;
    return "—";
  }
  if (key === "type") return paymentTypeLabel(value);
  if (key === "date") return formatDateBn(String(value));
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

const historyRowsFromUpdates = (entries) => {
  const byCanon = new Map();
  for (const entry of entries) {
    const canon = HISTORY_KEY_TO_CANON[entry.key];
    if (!canon || byCanon.has(canon)) continue;
    const field = VISIBLE_HISTORY_FIELDS.find((f) => f.key === canon);
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

export const summarizeDailyRecordLog = (log, billingNameFn) => {
  if (!log) return "—";
  const fields = snapshotFields(log.changes);
  const bits = [];
  if (fields.present != null && fields.present !== "") {
    bits.push(formatLogValue("present", fields.present, billingNameFn));
  }
  const extra = fields.extra_earn ?? fields.extra;
  if (extra != null && Number(extra) > 0) {
    bits.push(`বাড়তি কাজ ${formatLogValue("extra", extra, billingNameFn)}`);
  }
  const payment = fields.fooding_pay ?? fields.payment ?? fields.amount;
  const advance = fields.advance_pay ?? fields.advance;
  const ret = fields.return_amount ?? fields.return;
  if (payment != null && payment !== "") {
    bits.push(`খোরাকি ${formatLogValue("amount", payment, billingNameFn)}`);
  }
  if (advance != null && advance !== "") {
    bits.push(`অ্যাডভান্স ${formatLogValue("amount", advance, billingNameFn)}`);
  }
  if (ret != null && ret !== "") {
    bits.push(`রিটার্ন ${formatLogValue("amount", ret, billingNameFn)}`);
  }
  if (SHOW_BILLING && (fields.billing != null || fields.billing_id != null)) {
    bits.push(
      formatLogValue(
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
              oldText={formatLogValue(entry.key, entry.old, billingNameFn)}
              newText={formatLogValue(entry.key, entry.next, billingNameFn)}
            />
          </Fragment>
        ))}
      </span>
    );
  }
  return summarize(log, billingNameFn);
};

export const DailyRecordHistoryPanel = ({
  isLoading,
  error,
  logs,
  expandedId,
  setExpandedId,
  fieldLabels = RECORD_LOG_FIELD_LABELS,
  billingNameFn,
  summarize = summarizeDailyRecordLog,
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
          oldText={formatLogValue(row.key, row.old, billingNameFn)}
          newText={formatLogValue(row.key, row.next, billingNameFn)}
          newClassName={row.kind === "number" ? "tabular-nums" : ""}
        />
      );
    }
    return formatLogValue(row.key, row.value, billingNameFn);
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
