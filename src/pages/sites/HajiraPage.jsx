import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLabours,
  updateLabourAttendance,
  updateLabourPayment,
} from "../../api/labours.js";
import {
  createLabourAttendances,
  createLabourPayments,
  fetchBillingCategories,
  fetchLabourAttendances,
  fetchLabourPayments,
} from "../../api/sites.js";
import {
  PRESENT_OPTIONS,
  buildHajiraEditRows,
  buildHajiraViewRows,
} from "../../api/types/hajira.js";
import {
  activityTextToneClass,
  activityToneClass,
  applyActivitiesToViewRows,
} from "../../api/types/activity.js";
import { fetchActivities, reviewActivitiesBulk } from "../../api/activities.js";
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

const returnAmountOf = (row) => {
  if (row.return === "" || row.return == null) return 0;
  return Number(row.return) || 0;
};

const attendancePayload = (row, date) => ({
  labour: row.labourId,
  date,
  present: hasPresent(row) ? Number(row.present) : null,
  salary: row.salary === "" || row.salary == null ? null : Number(row.salary),
  extra: Number(row.extra) || 0,
  note: row.extraNote?.trim() ? row.extraNote.trim() : null,
  billing:
    row.billing === "" || row.billing == null ? null : Number(row.billing),
});

const attendancePatchPayload = (row) => ({
  present: hasPresent(row) ? Number(row.present) : null,
  salary: row.salary === "" || row.salary == null ? null : Number(row.salary),
  extra: Number(row.extra) || 0,
  note: row.extraNote?.trim() ? row.extraNote.trim() : null,
  billing:
    row.billing === "" || row.billing == null ? null : Number(row.billing),
});

const isAttendanceDirty = (row, initial) =>
  String(row.present) !== String(initial.present) ||
  String(row.salary) !== String(initial.salary) ||
  Number(row.extra) !== Number(initial.extra) ||
  String(row.extraNote ?? "") !== String(initial.extraNote ?? "") ||
  String(row.billing ?? "") !== String(initial.billing ?? "");

const hasAttendanceData = (row) =>
  hasPresent(row) ||
  hasExtra(row) ||
  Boolean(row.extraNote?.trim()) ||
  Boolean(row.billing);

const isPaymentDirty = (row, initial, key) =>
  String(row[key] ?? "") !== String(initial[key] ?? "") ||
  String(row[`${key}Note`] ?? "") !== String(initial[`${key}Note`] ?? "");

const paymentAmount = (row, key) => {
  const v = row[key];
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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
  { value: "return", label: "রিটার্ন" },
];

const filterLabel = (options, value) =>
  options.find((opt) => opt.value === value)?.label ?? options[0]?.label ?? "";

const formatMetaDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
};

const wasUpdated = (createdAt, updatedAt) => {
  if (!createdAt || !updatedAt) return false;
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated !== created;
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
    key: "return",
    noteKey: "returnNote",
    idKey: "returnId",
    sealedKey: "returnSealed",
    type: "return",
    label: "রিটার্ন",
  },
];

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

  const canAddAttendance = can(PERMS.addAttendance);
  const canChangeAttendance = can(PERMS.changeAttendance);
  const canAddPayment = can(PERMS.addLabourPayment);
  const canChangePayment = can(PERMS.changeLabourPayment);
  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, "view_activitylog");
  const canChangeActivityLog =
    can(PERMS.changeActivityLog) ||
    hasPermissionSuffix(profile, "change_activitylog");
  const showAyColumn = Boolean(isCompanyAdmin) && !editing;

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
  const [hajiraModal, setHajiraModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentTab, setPaymentTab] = useState(PAYMENT_SPECS[0].key);
  const [earningsFilter, setEarningsFilter] = useState("earn");
  const [paymentFilter, setPaymentFilter] = useState(["payment"]);
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

  const attendanceQuery = useQuery({
    queryKey: ["sites", siteId, "labour-attendances", { date }],
    queryFn: async () => {
      const { data } = await fetchLabourAttendances(siteId, { date });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId && date),
  });

  const paymentQuery = useQuery({
    queryKey: ["sites", siteId, "labour-payments", { date }],
    queryFn: async () => {
      const { data } = await fetchLabourPayments(siteId, { date });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId && date),
  });

  const billingQuery = useQuery({
    queryKey: ["sites", siteId, "billing-categories", { is_active: true }],
    queryFn: async () => {
      const { data } = await fetchBillingCategories(siteId, {
        is_active: true,
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId),
  });

  const laboursQuery = useQuery({
    queryKey: ["labours", { current_site: siteId, is_active: true }],
    queryFn: async () => {
      const { data } = await fetchLabours({
        current_site: siteId,
        is_active: true,
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(editing && siteId),
  });

  const activityAttendanceQuery = useQuery({
    queryKey: [
      "activities",
      { site: siteId, business_date: date, entity_type: "attendance" },
    ],
    queryFn: async () => {
      const { data } = await fetchActivities({
        site: siteId,
        business_date: date,
        entity_type: "attendance",
        reviewed: false,
        paginate: false,
      });
      return data;
    },
    enabled: Boolean(!editing && canViewActivityLog && siteId && date),
  });

  const activityPaymentQuery = useQuery({
    queryKey: [
      "activities",
      { site: siteId, business_date: date, entity_type: "labour_payment" },
    ],
    queryFn: async () => {
      const { data } = await fetchActivities({
        site: siteId,
        business_date: date,
        entity_type: "labour_payment",
        reviewed: false,
        paginate: false,
      });
      return data;
    },
    enabled: Boolean(!editing && canViewActivityLog && siteId && date),
  });

  const unreviwedActivityIds = useMemo(() => {
    const ids = new Set();
    for (const log of activityAttendanceQuery.data ?? []) {
      if (log?.id != null) ids.add(Number(log.id));
    }
    for (const log of activityPaymentQuery.data ?? []) {
      if (log?.id != null) ids.add(Number(log.id));
    }
    return [...ids].filter((id) => Number.isFinite(id));
  }, [activityAttendanceQuery.data, activityPaymentQuery.data]);

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

  // Exit edit mode when site/date changes.
  useEffect(() => {
    setEditing(false);
    setApiError(null);
    setHajiraModal(null);
    setPaymentModal(null);
    setEarningsFilter("earn");
    setPaymentFilter(["payment"]);
    setBillingFilter("all");
    setHajiraFilter(["present", "extra", "billing"]);
  }, [siteId, date]);

  // View mode: map records by labour from attendance/payment only.
  useEffect(() => {
    if (editing) return;
    if (!attendanceQuery.isSuccess || !paymentQuery.isSuccess) return;
    let next = buildHajiraViewRows(
      attendanceQuery.data ?? [],
      paymentQuery.data ?? [],
    );
    if (canViewActivityLog) {
      next = applyActivitiesToViewRows(
        next,
        activityAttendanceQuery.data ?? [],
        activityPaymentQuery.data ?? [],
      );
    }
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  }, [
    editing,
    canViewActivityLog,
    attendanceQuery.isSuccess,
    paymentQuery.isSuccess,
    attendanceQuery.data,
    paymentQuery.data,
    activityAttendanceQuery.data,
    activityPaymentQuery.data,
  ]);

  // Edit mode: remap already-loaded records onto this site's labours.
  useEffect(() => {
    if (!editing) return;
    if (!laboursQuery.isSuccess) return;
    const next = buildHajiraEditRows(
      laboursQuery.data ?? [],
      attendanceQuery.data ?? [],
      paymentQuery.data ?? [],
    );
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  }, [
    editing,
    laboursQuery.isSuccess,
    laboursQuery.data,
    attendanceQuery.data,
    paymentQuery.data,
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
  const viewPaymentFilter = editing ? ["payment", "return"] : paymentFilter;
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

  const totals = useMemo(() => {
    let present = 0;
    let earnings = 0;
    let payment = 0;
    let ret = 0;
    for (const row of visibleRows) {
      present += hajiraTotalValue(row, viewHajiraFilter);
      earnings += dayEarnings(row, viewEarningsFilter);
      const pay = paymentAmountOf(row);
      const rtn = returnAmountOf(row);
      if (viewPaymentFilter.includes("payment")) payment += pay;
      if (viewPaymentFilter.includes("return")) ret += rtn;
    }
    return { present, earnings, payment, return: ret };
  }, [visibleRows, viewEarningsFilter, viewPaymentFilter, viewHajiraFilter]);

  const showPaymentAmount = (row) =>
    viewPaymentFilter.includes("payment") && paymentAmountOf(row) !== 0;

  const showReturnAmount = (row) =>
    viewPaymentFilter.includes("return") && returnAmountOf(row) !== 0;

  const modalEditable = editing;

  const attendanceLocked = (row) =>
    Boolean(row?.attendanceSealed) ||
    (row?.attendanceId ? !canChangeAttendance : !canAddAttendance);

  /** Each payment slot is its own record, so create/change rights differ per slot. */
  const paymentSlotLocked = (row, spec) =>
    Boolean(row?.[spec.sealedKey]) ||
    (row?.[spec.idKey] ? !canChangePayment : !canAddPayment);

  const openHajiraModal = (row) => {
    setHajiraModal({
      labourId: row.labourId,
      labourName: row.labourName,
      present: row.present === "" ? "" : String(row.present),
      salary: row.salary,
      extra: row.extra || "",
      note: row.extraNote ?? "",
      billing: row.billing ?? "",
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
    const firstOpen =
      PAYMENT_SPECS.find((spec) => !paymentSlotLocked(row, spec)) ??
      PAYMENT_SPECS[0];
    setPaymentTab(firstOpen.key);
    setPaymentModal({
      labourId: row.labourId,
      labourName: row.labourName,
      payment: row.payment,
      paymentNote: row.paymentNote ?? "",
      paymentSealed: row.paymentSealed,
      paymentId: row.paymentId,
      paymentCreatedAt: row.paymentCreatedAt ?? null,
      paymentUpdatedAt: row.paymentUpdatedAt ?? null,
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
    const spec = PAYMENT_SPECS.find((s) => s.key === paymentTab);
    if (!spec) return;
    setPaymentModal({
      ...paymentModal,
      [spec.key]: initial[spec.key],
      [spec.noteKey]: initial[spec.noteKey] ?? "",
    });
  };

  const applyPaymentModalDefaults = () => {
    if (!paymentModal || !modalEditable) return;
    const spec = PAYMENT_SPECS.find((s) => s.key === paymentTab);
    if (!spec || spec.key !== "payment") return;
    if (paymentSlotLocked(paymentModal, spec)) return;
    const row = rows.find((r) => r.labourId === paymentModal.labourId);
    if (!row) return;
    setPaymentModal((m) => {
      if (!m) return m;
      if (m.payment !== "" && m.payment != null) return m;
      return { ...m, payment: row.defaultFooding };
    });
  };

  const onAcceptChanges = async () => {
    if (!canChangeActivityLog || unreviwedActivityIds.length === 0) return;
    const ok = await confirmAction({
      title: "পরিবর্তন গুলোতে আপনি কি সম্মত?",
      text: `${selectedDate} তারিখের হাজিরা ঠিক আছে বলে আপনি সম্মতি দিচ্ছেন। পরে বাতিল করতে পারবেন না। `,
      confirmText: "সম্মত",
      cancelText: "বাতিল করুন",
    });
    if (!ok) return;

    setReviewing(true);
    setApiError(null);
    try {
      await reviewActivitiesBulk(unreviwedActivityIds);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "activities",
            { site: siteId, business_date: date, entity_type: "attendance" },
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "activities",
            {
              site: siteId,
              business_date: date,
              entity_type: "labour_payment",
            },
          ],
        }),
      ]);
      toastSuccess("পরিবর্তনগুলো গ্রহণ করা হয়েছে");
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
    const next = buildHajiraViewRows(
      attendanceQuery.data ?? [],
      paymentQuery.data ?? [],
    );
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const attendanceCreates = [];
      const attendanceUpdates = [];
      const paymentCreates = [];
      const paymentUpdates = [];
      let blocked = 0;

      for (const row of rows) {
        const initial =
          initialRows.find((r) => r.labourId === row.labourId) ?? row;

        if (
          !row.attendanceSealed &&
          isAttendanceDirty(row, initial) &&
          (row.attendanceId || hasAttendanceData(row))
        ) {
          if (row.attendanceId) {
            if (canChangeAttendance) {
              attendanceUpdates.push({
                labourId: row.labourId,
                id: row.attendanceId,
                payload: attendancePatchPayload(row),
              });
            } else {
              blocked += 1;
            }
          } else if (hasAttendanceData(row)) {
            if (canAddAttendance) {
              attendanceCreates.push(attendancePayload(row, date));
            } else {
              blocked += 1;
            }
          }
        }

        for (const spec of PAYMENT_SPECS) {
          if (row[spec.sealedKey]) continue;
          if (!isPaymentDirty(row, initial, spec.key)) continue;
          const amount = paymentAmount(row, spec.key);
          const note = row[spec.noteKey]?.trim()
            ? row[spec.noteKey].trim()
            : null;
          const id = row[spec.idKey];

          if (id) {
            if (!canChangePayment) {
              blocked += 1;
              continue;
            }
            paymentUpdates.push({
              labourId: row.labourId,
              id,
              payload: { amount: amount ?? 0, note },
            });
          } else if (amount != null && amount > 0) {
            if (!canAddPayment) {
              blocked += 1;
              continue;
            }
            paymentCreates.push({
              labour: row.labourId,
              date,
              type: spec.type,
              amount,
              note,
            });
          }
        }
      }

      if (attendanceCreates.length) {
        await createLabourAttendances(siteId, attendanceCreates);
      }
      if (paymentCreates.length) {
        await createLabourPayments(siteId, paymentCreates);
      }

      await Promise.all([
        ...attendanceUpdates.map((item) =>
          updateLabourAttendance(item.labourId, item.id, item.payload),
        ),
        ...paymentUpdates.map((item) =>
          updateLabourPayment(item.labourId, item.id, item.payload),
        ),
      ]);

      return {
        attendanceCreates: attendanceCreates.length,
        attendanceUpdates: attendanceUpdates.length,
        paymentCreates: paymentCreates.length,
        paymentUpdates: paymentUpdates.length,
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
        row.attendanceSealed ||
        !(row.attendanceId || hasAttendanceData(row))
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
      const total =
        result.attendanceCreates +
        result.attendanceUpdates +
        result.paymentCreates +
        result.paymentUpdates;
      if (total === 0) {
        toastInfo(
          result.blocked > 0
            ? messageForCode("permission_denied")
            : "সেভ করার মতো কোনো পরিবর্তন নেই।",
        );
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ["sites", siteId, "labour-attendances"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sites", siteId, "labour-payments"],
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
    attendanceQuery.isLoading ||
    paymentQuery.isLoading ||
    (editing && laboursQuery.isLoading);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const loadError =
    attendanceQuery.error ||
    paymentQuery.error ||
    (editing ? laboursQuery.error : null);
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
              <th>নং</th>
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
                    পেমেন্ট
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
                    পেমেন্ট
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
                const paymentActivityTone = !editing
                  ? activityTextToneClass(row.paymentTone)
                  : "";
                const earn = dayEarnings(row, viewEarningsFilter);
                const showPay = showPaymentAmount(row);
                const showRet = showReturnAmount(row);
                const attendanceLines = attendanceCellLines(
                  row,
                  billingFullLabel,
                  viewHajiraFields,
                );

                return (
                  <tr
                    key={row.labourId}
                    className={[
                      "border-b border-base-300/70",
                      !editing ? activityToneClass(row.activityTone) : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td className="tabular-nums text-base-content/60">
                      {formatBnNumber(index + 1)}
                    </td>
                    <td className="font-medium whitespace-nowrap max-w-28 truncate">
                      {row.labourName}
                    </td>
                    <td className="text-right">
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
                      <td className="text-right">
                        <button
                          type="button"
                          className={`btn btn-ghost btn-xs h-auto min-h-0 px-1 py-0.5 font-normal tabular-nums w-full justify-end ${hajiraGroupTone}`}
                          onClick={() => openHajiraModal(row)}
                        >
                          {earn ? formatBnNumber(earn) : "—"}
                        </button>
                      </td>
                    ) : null}
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs h-auto min-h-0 px-1 py-0.5 font-normal text-right leading-tight w-full"
                        onClick={() => openPaymentModal(row)}
                      >
                        {showPay || showRet ? (
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
                  {totals.payment || totals.return ? (
                    <span className="block w-full tabular-nums space-y-0.5 text-right">
                      {totals.payment ? (
                        <span className="block w-full text-right text-error">
                          {formatBnNumber(totals.payment)}
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
      ) : (
        <>
          <button
            type="button"
            className="btn btn-outline btn-primary fixed bottom-16 left-4 z-40 shadow-lg bg-base-100"
            onClick={onAcceptChanges}
            disabled={
              !date ||
              reviewing ||
              !canChangeActivityLog ||
              unreviwedActivityIds.length === 0
            }
          >
            {reviewing ? (
              <span className="loading loading-spinner loading-sm" />
            ) : null}
            অডিট করুন
          </button>
          {canAddAttendance ? (
            <button
              type="button"
              className="btn btn-primary fixed bottom-16 right-4 z-40 shadow-lg"
              onClick={onStartEdit}
              disabled={!date || siteInactive}
            >
              যোগ করুন
            </button>
          ) : null}
        </>
      )}

      <dialog
        id={HAJIRA_MODAL_ID}
        className="modal"
        onClose={() => setHajiraModal(null)}
      >
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>

          <h3 className="font-bold text-lg">
            {hajiraModal
              ? `হাজিরা (${hajiraModal.labourName})`
              : "হাজিরা"}
          </h3>
          {hajiraModal?.attendanceCreatedAt ? (
            <p className="text-xs text-base-content/55 tabular-nums -mt-1">
              তৈরি: {formatMetaDate(hajiraModal.attendanceCreatedAt)}
              {wasUpdated(
                hajiraModal.attendanceCreatedAt,
                hajiraModal.attendanceUpdatedAt,
              ) ? (
                <>
                  <span className="mx-1.5 opacity-60">·</span>
                  আপডেট {formatMetaDate(hajiraModal.attendanceUpdatedAt)}
                </>
              ) : null}
            </p>
          ) : null}

          {hajiraModal ? (
            <div className="space-y-3 pt-3">
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
                        hajiraModal.billing == null || hajiraModal.billing === ""
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
                          !opts.some((b) => String(b.id) === String(cur))
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
      </dialog>

      <dialog
        id={PAYMENT_MODAL_ID}
        className="modal"
        onClose={() => setPaymentModal(null)}
      >
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>

          <h3 className="font-bold text-lg">
            {paymentModal
              ? `পেমেন্ট (${paymentModal.labourName})`
              : "পেমেন্ট"}
          </h3>
          {(() => {
            const createdAt =
              paymentTab === "return"
                ? paymentModal?.returnCreatedAt
                : paymentModal?.paymentCreatedAt;
            const updatedAt =
              paymentTab === "return"
                ? paymentModal?.returnUpdatedAt
                : paymentModal?.paymentUpdatedAt;
            if (!createdAt) return null;
            return (
              <p className="text-xs text-base-content/55 tabular-nums -mt-1">
                তৈরি: {formatMetaDate(createdAt)}
                {wasUpdated(createdAt, updatedAt) ? (
                  <>
                    <span className="mx-1.5 opacity-60">·</span>
                    আপডেট {formatMetaDate(updatedAt)}
                  </>
                ) : null}
              </p>
            );
          })()}

          {paymentModal ? (
            <div className="space-y-3 pt-3">
              <div role="tablist" className="tabs tabs-bordered">
                {PAYMENT_SPECS.map((spec) => (
                  <button
                    key={spec.key}
                    type="button"
                    role="tab"
                    className={`tab ${paymentTab === spec.key ? "tab-active" : ""}`}
                    onClick={() => setPaymentTab(spec.key)}
                  >
                    {spec.label}
                  </button>
                ))}
              </div>

              {PAYMENT_SPECS.filter((spec) => spec.key === paymentTab).map(
                (spec) => {
                  const fieldLocked =
                    !modalEditable || paymentSlotLocked(paymentModal, spec);
                  const slotDiffs =
                    fieldLocked
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
                    "amount",
                    paymentModal[spec.key],
                    formatDiffNumber,
                  );
                  return (
                    <div key={spec.key} className="space-y-3">
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
                },
              )}

              {modalEditable ? (
                <div className="modal-action pt-1 flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={resetPaymentModal}
                    disabled={PAYMENT_SPECS.some(
                      (spec) =>
                        spec.key === paymentTab &&
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
                      disabled={
                        paymentTab !== "payment" ||
                        paymentSlotLocked(paymentModal, PAYMENT_SPECS[0])
                      }
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
          <h3 className="font-bold text-lg pr-8">পেমেন্ট</h3>
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
          <h3 className="font-bold text-lg">পেমেন্ট</h3>
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
