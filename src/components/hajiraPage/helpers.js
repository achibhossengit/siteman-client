import { messageForCode } from "../../api/errors.js";
import { formatBnNumber } from "../../utils/format.js";
import { BULK_CREATE_FIELD_LABELS, PAYMENT_SPECS } from "./constants.js";

export const cloneRows = (rows) => structuredClone(rows);

export const numOrEmpty = (value) => {
  if (value === "" || value == null) return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
};

export const hasPresent = (row) => row.present !== "" && row.present != null;

export const hasExtra = (row) => row.extra !== "" && row.extra != null;

export const hasBilling = (row) => row.billing !== "" && row.billing != null;

export const amountPositive = (value) => {
  if (value === "" || value == null) return false;
  return Number(value) > 0;
};

/** Backend: at least one of present/extra/fooding/advance/return must be non-zero. */
export const hasMeaningfulDayValue = (row) =>
  (hasPresent(row) && Number(row.present) > 0) ||
  amountPositive(row.extra) ||
  amountPositive(row.payment) ||
  amountPositive(row.advance) ||
  amountPositive(row.return);

export const lacksMeaningfulDayValue = (row) => !hasMeaningfulDayValue(row);

export const presentEarnings = (row) => {
  if (!hasPresent(row) || Number(row.present) === 0) return 0;
  const salary =
    row.salary === "" || row.salary == null ? 0 : Number(row.salary);
  return Number(row.present) * salary;
};

export const dayEarnings = (row, selected = ["from_present", "from_extra"]) => {
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

export const hajiraTotalValue = (row, hajiraFilter = "hajira") => {
  if (hajiraFilter === "salary") {
    return row.salary !== "" && row.salary != null ? Number(row.salary) || 0 : 0;
  }
  if (hajiraFilter === "extra") {
    return row.extra !== "" && row.extra != null ? Number(row.extra) || 0 : 0;
  }
  return hasPresent(row) ? Number(row.present) || 0 : 0;
};

export const attendanceCellLines = (row, billingNameFn, selectedFields) => {
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

export const paymentAmountOf = (row) => {
  if (row.payment === "" || row.payment == null) return 0;
  return Number(row.payment) || 0;
};

export const advanceAmountOf = (row) => {
  if (row.advance === "" || row.advance == null) return 0;
  return Number(row.advance) || 0;
};

export const returnAmountOf = (row) => {
  if (row.return === "" || row.return == null) return 0;
  return Number(row.return) || 0;
};

export const hasAmount = (value) => value !== "" && value != null;

/** Billing only when at least one meaningful day value exists. */
export const canSetBillingOnRow = (row) => hasMeaningfulDayValue(row);

export const isAttendanceDirty = (row, initial) =>
  String(row.present) !== String(initial.present) ||
  String(row.salary) !== String(initial.salary) ||
  String(row.extra ?? "") !== String(initial.extra ?? "") ||
  String(row.extraNote ?? "") !== String(initial.extraNote ?? "") ||
  String(row.billing ?? "") !== String(initial.billing ?? "");

export const amountKey = (value) =>
  value === "" || value == null ? "" : String(Number(value));

/** Present dropdown shows 0 for unset rows, so 0 and empty compare equal. */
export const presentKey = (value) =>
  value === "" || value == null || Number(value) === 0
    ? "0"
    : String(Number(value));

export const recordModalFromRow = (row) => ({
  labourId: row.labourId,
  labourName: row.labourName,
  labourPhoto: row.labourPhoto,
  labourCurrentSite: row.labourCurrentSite ?? null,
  lastSessionDate: row.lastSessionDate ?? null,
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

export const isRecordModalDirty = (modal, row) => {
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

export const isPaymentDirty = (row, initial, key) =>
  String(row[key] ?? "") !== String(initial[key] ?? "") ||
  String(row[`${key}Note`] ?? "") !== String(initial[`${key}Note`] ?? "");

export const hasAttendanceData = (row) =>
  hasMeaningfulDayValue(row) ||
  Boolean(row.extraNote?.trim()) ||
  Boolean(row.billing) ||
  Boolean(row.paymentNote?.trim()) ||
  Boolean(row.advanceNote?.trim()) ||
  Boolean(row.returnNote?.trim());

export const recordIdOf = (row) =>
  row?.recordId ?? row?.attendanceId ?? row?.paymentId ?? null;

export const recordSealedOf = (row) =>
  Boolean(
    row?.recordSealed ||
      row?.attendanceSealed ||
      row?.paymentSealed ||
      row?.advanceSealed ||
      row?.returnSealed,
  );

/** New records must be after labour.last_session_date (ISO date strings). */
export const isCreateBlockedByLastSession = (row, recordDate) => {
  if (recordIdOf(row)) return false;
  const last = row?.lastSessionDate;
  if (!last || !recordDate) return false;
  return String(recordDate) <= String(last);
};

export const formatLastSessionDateBn = (isoDate) => {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(isoDate);
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
};

export const lastSessionCreateBlockedMessage = (row) => {
  const dateLabel = formatLastSessionDateBn(row?.lastSessionDate);
  if (!dateLabel) {
    return messageForCode("record_date_not_after_last_session");
  }
  return `এই শ্রমিক কে সর্বশেষ হিসাব দেওয়া হয়েছে ${dateLabel}। নতুন হাজিরা এই তারিখের পরে হতে হবে।`;
};

export const emptyBulkAttendance = () => ({
  present: "0",
  salary: "",
});

export const emptyBulkPayment = () => ({
  payment: "",
});

export const emptyBulkBilling = () => ({
  billing: "none",
});

export const isBulkAttendanceDirty = (form) =>
  String(form.present) !== "0" || (form.salary !== "" && form.salary != null);

export const isBulkPaymentDirty = (form) =>
  form.payment !== "" && form.payment != null;

export const isBulkBillingDirty = (form) =>
  form.billing !== "" && form.billing != null;

export const isBulkAttendanceZeroInvalid = (form) => {
  if (form.present === "" || form.present == null) return false;
  return Number(form.present) === 0;
};

export const filterHeaderTitle = (title, selected, required) =>
  required.every((value) => selected.includes(value)) ? title : `${title}*`;

export const displayModalValue = (value) => {
  if (value === "" || value == null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? formatBnNumber(n) : String(value);
};

/** Bulk review validation: attr ids + missing id details. */
export const formatBulkReviewError = (parsed) => {
  const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
  const idsError = errors.find((e) => e.attr === "ids");
  const missingIds = errors
    .filter((e) => e.attr === "missing")
    .map((e) => e.rawDetail ?? e.detail)
    .filter(Boolean);

  if (idsError || missingIds.length) {
    const main =
      idsError?.rawDetail || idsError?.detail || "কিছু অডিট করা যায়নি।";
    if (!missingIds.length) return String(main);
    return `${main} (missing: ${missingIds.join(", ")})`;
  }

  return parsed?.message || messageForCode("error");
};

/** Bulk create attrs like `0.date` → per-row map + leftover general errors. */
export const formatBulkDailyRecordCreateError = (parsed, createItems = []) => {
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

    const fieldLabel = field ? (BULK_CREATE_FIELD_LABELS[field] ?? field) : null;
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

export const isRecordDirty = (row, initial) =>
  isAttendanceDirty(row, initial) ||
  PAYMENT_SPECS.some((spec) => isPaymentDirty(row, initial, spec.key));

/** gray = unchanged, success = create, amber = update */
export const fieldTone = (row, initial, keys, idKey) => {
  const changed = (Array.isArray(keys) ? keys : [keys]).some(
    (k) => String(row[k] ?? "") !== String(initial[k] ?? ""),
  );
  if (!changed) return "text-base-content/60";
  return row[idKey] ? "text-amber-500" : "text-success";
};

export const paymentLineTone = (row, initial, keys, idKey, typeClass) => {
  const tone = fieldTone(row, initial, keys, idKey);
  // Keep amber for pending updates; never paint create/activity green on amounts.
  if (tone === "text-amber-500") return tone;
  return typeClass;
};

/** Staged local row that "নিশ্চিত" will POST as a new daily record. */
export const isPendingCreateRow = (row, initial, date) => {
  if (
    recordIdOf(row) ||
    recordSealedOf(row) ||
    isCreateBlockedByLastSession(row, date)
  ) {
    return false;
  }
  return isRecordDirty(row, initial) && hasAttendanceData(row);
};

/** Column filters must keep at least one option selected. */
export const isLastCheckedFilter = (selected, value) =>
  Array.isArray(selected) &&
  selected.includes(value) &&
  selected.length === 1;

export const toggleRequiredFilter = (prev, value) => {
  const selected = Array.isArray(prev) ? prev : [];
  if (selected.includes(value)) {
    if (selected.length <= 1) return selected;
    return selected.filter((item) => item !== value);
  }
  return [...selected, value];
};
