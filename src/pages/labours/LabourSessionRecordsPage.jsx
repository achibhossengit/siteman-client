import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchLabourDailyRecords,
  fetchLabourDetail,
  fetchLabourLatestSession,
  fetchLabourRunningSession,
  fetchLabourSession,
  updateLabourDailyRecord,
} from "../../api/labours.js";
import { fetchActiveBillingCategories } from "../../api/sites.js";
import {
  PRESENT_OPTIONS,
  toDailyRecordPatchPayload,
} from "../../api/types/hajira.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import {
  concatBillingName,
  formatBnNumber,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import { toastInfo, toastSuccess } from "../../utils/feedback.js";
import { PERMS } from "../../utils/permissions.js";

const ATTENDANCE_MODAL_ID = "session_record_attendance_modal";
const PAYMENT_MODAL_ID = "session_record_payment_modal";
const BILLING_MODAL_ID = "session_record_billing_modal";
const EARNINGS_FILTER_MODAL_ID = "session_record_earnings_filter_modal";
const PAYMENT_FILTER_MODAL_ID = "session_record_payment_filter_modal";
const BILLING_FILTER_MODAL_ID = "session_record_billing_filter_modal";
const HAJIRA_FILTER_MODAL_ID = "session_record_hajira_filter_modal";

const HAJIRA_FILTER_OPTIONS = [
  { value: "hajira", label: "হাজিরা" },
  { value: "present", label: "উপস্থিতি" },
  { value: "salary", label: "বেতন" },
  { value: "extra", label: "বাড়তি" },
];

const EARNINGS_FILTER_OPTIONS = [
  { value: "earn", label: "আয়" },
  { value: "from_present", label: "হাজিরা আয়" },
  { value: "from_extra", label: "বাড়তি আয়" },
];

const PAYMENT_FILTER_OPTIONS = [
  { value: "payment", label: "পেমেন্ট" },
  { value: "return", label: "রিটার্ন" },
];

const PAYMENT_SPECS = [
  {
    key: "payment",
    noteKey: "paymentNote",
    idKey: "paymentId",
    sealedKey: "paymentSealed",
    label: "পেমেন্ট",
  },
  {
    key: "return",
    noteKey: "returnNote",
    idKey: "returnId",
    sealedKey: "returnSealed",
    label: "রিটার্ন",
  },
];

const cloneRows = (rows) => structuredClone(rows);

const num = (value, fallback = 0) => {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const numOrEmpty = (value) => {
  if (value == null || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
};

const formatReadableDate = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
  }).format(date);
};

const filterLabel = (options, value) =>
  options.find((option) => option.value === value)?.label ??
  options[0]?.label ??
  "";

const buildRows = (records) => {
  const rows = [];

  for (const record of records) {
    if (!record?.date) continue;
    const sealed = Boolean(record.is_sealed);
    const recordId = record.id ?? null;
    rows.push({
      date: record.date,
      siteId: record.site ?? null,
      recordId,
      sealed,
      // Legacy aliases for existing lock / modal helpers
      attendanceId: recordId,
      attendanceSealed: sealed,
      paymentId: recordId,
      paymentSealed: sealed,
      returnId: recordId,
      returnSealed: sealed,
      present:
        record.present == null || record.present === ""
          ? ""
          : Number(record.present),
      salary:
        record.wage == null || record.wage === "" ? "" : Number(record.wage),
      extra: num(record.extra_earn),
      extraNote: record.note ?? "",
      billing:
        record.billing == null || record.billing === ""
          ? ""
          : String(record.billing),
      payment: numOrEmpty(record.fooding_pay),
      paymentNote: "",
      advance: numOrEmpty(record.advance_pay),
      return: numOrEmpty(record.return_amount),
      returnNote: "",
    });
  }

  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

const hasPresent = (row) => row.present !== "" && row.present != null;

const presentEarnings = (row) =>
  (hasPresent(row) ? Number(row.present) : 0) * num(row.salary);

const rowEarnings = (row, filter = "earn") => {
  const fromPresent = presentEarnings(row);
  const fromExtra = num(row.extra);
  if (filter === "from_present") return fromPresent;
  if (filter === "from_extra") return fromExtra;
  return fromPresent + fromExtra;
};

const hasExtra = (row) => num(row.extra) > 0;

const hajiraFieldValue = (row, hajiraFilter = "hajira") => {
  if (hajiraFilter === "present") {
    return hasPresent(row) ? formatBnNumber(row.present) : null;
  }
  if (hajiraFilter === "salary") {
    return row.salary !== "" && row.salary != null
      ? formatBnNumber(row.salary)
      : null;
  }
  if (hajiraFilter === "extra") {
    return hasExtra(row) ? formatBnNumber(row.extra) : null;
  }
  if (!hasPresent(row) && !hasExtra(row)) return null;
  return "combined";
};

const hajiraTotalValue = (row, hajiraFilter = "hajira") => {
  if (hajiraFilter === "salary") {
    return row.salary !== "" && row.salary != null ? num(row.salary) : 0;
  }
  if (hajiraFilter === "extra") return num(row.extra);
  return num(row.present);
};

const isAttendanceDirty = (row, initial) =>
  String(row.present ?? "") !== String(initial.present ?? "") ||
  String(row.salary ?? "") !== String(initial.salary ?? "") ||
  num(row.extra) !== num(initial.extra) ||
  String(row.extraNote ?? "") !== String(initial.extraNote ?? "") ||
  String(row.billing ?? "") !== String(initial.billing ?? "");

const isPaymentDirty = (row, initial, spec) =>
  String(row[spec.key] ?? "") !== String(initial[spec.key] ?? "") ||
  String(row[spec.noteKey] ?? "") !== String(initial[spec.noteKey] ?? "");

const isRecordDirty = (row, initial) =>
  isAttendanceDirty(row, initial) ||
  String(row.advance ?? "") !== String(initial.advance ?? "") ||
  PAYMENT_SPECS.some((spec) => isPaymentDirty(row, initial, spec));

const fieldTone = (dirty) =>
  dirty ? "text-amber-500" : "text-base-content/60";

export const LabourSessionRecordsPage = () => {
  const { labourId, sessionId } = useParams();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const isRunningRoute = sessionId === "running";
  const isLatestRoute = sessionId === "latest";
  const canView = can(PERMS.viewLabourSession);
  const canChangeDailyRecord = can(PERMS.changeDailyRecord);

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState([]);
  const [initialRows, setInitialRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [attendanceModal, setAttendanceModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [billingModal, setBillingModal] = useState(null);
  const [paymentTab, setPaymentTab] = useState("payment");
  const [earningsFilter, setEarningsFilter] = useState("earn");
  const [paymentFilter, setPaymentFilter] = useState("payment");
  const [billingFilter, setBillingFilter] = useState("all");
  const [hajiraFilter, setHajiraFilter] = useState("hajira");

  const labourQuery = useQuery({
    queryKey: ["labours", labourId],
    queryFn: async () => {
      const { data } = await fetchLabourDetail(labourId);
      return data;
    },
    enabled: Boolean(canView && labourId),
  });

  const sessionQuery = useQuery({
    queryKey: ["labours", labourId, "session-detail", sessionId],
    queryFn: async () => {
      if (isRunningRoute) {
        const { data } = await fetchLabourRunningSession(labourId);
        return data ? { ...data, is_running: true } : null;
      }
      if (isLatestRoute) {
        const { data } = await fetchLabourLatestSession(labourId);
        return data;
      }
      const { data } = await fetchLabourSession(labourId, sessionId);
      return data;
    },
    enabled: Boolean(canView && labourId && sessionId),
  });

  const session = sessionQuery.data;
  const recordsEnabled = Boolean(
    canView && labourId && session?.start_date && !session?.is_modified,
  );
  const rangeParams = {
    date__gte: session?.start_date,
    ...(session?.end_date ? { date__lte: session.end_date } : {}),
  };

  const dailyRecordsQuery = useQuery({
    queryKey: [
      "labours",
      labourId,
      "daily-records",
      sessionId,
      rangeParams,
    ],
    queryFn: async () => {
      const { data } = await fetchLabourDailyRecords(labourId, {
        ...rangeParams,
        all: true,
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: recordsEnabled,
  });

  const nextRows = useMemo(
    () => buildRows(dailyRecordsQuery.data ?? []),
    [dailyRecordsQuery.data],
  );

  useEffect(() => {
    if (editing) return;
    setRows(cloneRows(nextRows));
    setInitialRows(cloneRows(nextRows));
  }, [editing, nextRows]);

  const usedSiteIds = useMemo(
    () => [
      ...new Set(
        rows
          .map((row) => row.siteId)
          .filter((siteId) => siteId != null && siteId !== "")
          .map(String),
      ),
    ],
    [rows],
  );

  const billingQueries = useQueries({
    queries: usedSiteIds.map((siteId) => ({
      queryKey: ["sites", siteId, "billing-categories", "active"],
      queryFn: async () => {
        const { data } = await fetchActiveBillingCategories(siteId);
        return Array.isArray(data) ? data : [];
      },
      enabled: Boolean(siteId),
    })),
  });

  const billingBySite = useMemo(() => {
    const result = new Map();
    usedSiteIds.forEach((siteId, index) => {
      result.set(siteId, billingQueries[index]?.data ?? []);
    });
    return result;
  }, [usedSiteIds, billingQueries]);

  const billingNameById = useMemo(() => {
    const result = new Map();
    for (const options of billingBySite.values()) {
      for (const option of options) {
        result.set(String(option.id), option.name);
      }
    }
    return result;
  }, [billingBySite]);

  const billingFullLabel = (id) => {
    if (id == null || id === "") return NULL_BILLING_LABEL;
    return billingNameById.get(String(id)) ?? `#${id}`;
  };

  const billingLabel = (id) => {
    if (id == null || id === "") return NULL_BILLING_LABEL;
    const full = billingNameById.get(String(id));
    if (!full) return `#${id}`;
    return concatBillingName(full);
  };

  const billingFilterOptions = useMemo(() => {
    const options = [
      { value: "all", label: "বিলিং" },
      { value: "none", label: NULL_BILLING_LABEL },
    ];
    const seen = new Set();
    for (const siteOptions of billingBySite.values()) {
      for (const option of siteOptions) {
        const value = String(option.id);
        if (seen.has(value)) continue;
        seen.add(value);
        options.push({ value, label: option.name });
      }
    }
    return options;
  }, [billingBySite]);

  const billingFilterHeaderLabel =
    billingFilter === "all"
      ? "বিলিং"
      : billingFilter === "none"
        ? NULL_BILLING_LABEL
        : billingLabel(billingFilter);

  const initialByDate = useMemo(
    () => new Map(initialRows.map((row) => [row.date, row])),
    [initialRows],
  );

  const isDirty = useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(initialRows),
    [rows, initialRows],
  );

  const viewEarningsFilter = editing ? "earn" : earningsFilter;
  const viewPaymentFilter = editing ? "all" : paymentFilter;
  const viewBillingFilter = editing ? "all" : billingFilter;
  const viewHajiraFilter = editing ? "hajira" : hajiraFilter;

  const visibleRows = useMemo(() => {
    if (viewBillingFilter === "all") return rows;
    if (viewBillingFilter === "none") {
      return rows.filter((row) => row.billing == null || row.billing === "");
    }
    return rows.filter(
      (row) => String(row.billing ?? "") === String(viewBillingFilter),
    );
  }, [rows, viewBillingFilter]);

  const totals = useMemo(
    () =>
      visibleRows.reduce(
        (result, row) => {
          result.present += hajiraTotalValue(row, viewHajiraFilter);
          result.earnings += rowEarnings(row, viewEarningsFilter);
          if (viewPaymentFilter !== "return") {
            result.payment += num(row.payment);
          }
          if (viewPaymentFilter !== "payment") {
            result.return += num(row.return);
          }
          return result;
        },
        { present: 0, earnings: 0, payment: 0, return: 0 },
      ),
    [visibleRows, viewEarningsFilter, viewPaymentFilter, viewHajiraFilter],
  );

  const attendanceLocked = (row) =>
    !editing ||
    !row?.attendanceId ||
    row.attendanceSealed ||
    !canChangeDailyRecord;

  const paymentLocked = (row, spec) =>
    !editing ||
    !row?.[spec.idKey] ||
    row[spec.sealedKey] ||
    !canChangeDailyRecord;

  const canEditRecords = rows.some(
    (row) => row.recordId && !row.sealed && canChangeDailyRecord,
  );

  const updateRow = (date, patch) => {
    setRows((current) =>
      current.map((row) => (row.date === date ? { ...row, ...patch } : row)),
    );
  };

  const openAttendanceModal = (row) => {
    setAttendanceModal({
      date: row.date,
      siteId: row.siteId,
      attendanceId: row.attendanceId,
      attendanceSealed: row.attendanceSealed,
      present: row.present === "" ? "" : String(row.present),
      salary: row.salary,
      extra: row.extra || "",
      note: row.extraNote ?? "",
      billing: row.billing ?? "",
    });
    document.getElementById(ATTENDANCE_MODAL_ID)?.showModal();
  };

  const openBillingModal = ({ date, siteId, value, source }) => {
    setBillingModal({
      date,
      siteId,
      value: value ?? "",
      source,
    });
    document.getElementById(BILLING_MODAL_ID)?.showModal();
  };

  const pickBilling = (billingId) => {
    if (!billingModal) return;
    if (billingModal.source === "attendance") {
      setAttendanceModal((current) =>
        current ? { ...current, billing: billingId } : current,
      );
    } else {
      updateRow(billingModal.date, { billing: billingId });
    }
    document.getElementById(BILLING_MODAL_ID)?.close();
  };

  const saveAttendanceModal = () => {
    if (!attendanceModal || attendanceLocked(attendanceModal)) return;
    updateRow(attendanceModal.date, {
      present:
        attendanceModal.present === "" ? "" : Number(attendanceModal.present),
      salary: numOrEmpty(attendanceModal.salary),
      extra: num(attendanceModal.extra),
      extraNote: attendanceModal.note ?? "",
      billing: attendanceModal.billing ?? "",
    });
    document.getElementById(ATTENDANCE_MODAL_ID)?.close();
  };

  const resetAttendanceModal = () => {
    if (!attendanceModal) return;
    const initial = initialByDate.get(attendanceModal.date);
    if (!initial) return;
    setAttendanceModal((current) => ({
      ...current,
      present: initial.present === "" ? "" : String(initial.present),
      salary: initial.salary,
      extra: initial.extra || "",
      note: initial.extraNote ?? "",
      billing: initial.billing ?? "",
    }));
  };

  const openPaymentModal = (row) => {
    const firstEditable =
      PAYMENT_SPECS.find((spec) => !paymentLocked(row, spec)) ??
      PAYMENT_SPECS.find((spec) => row[spec.idKey]) ??
      PAYMENT_SPECS[0];
    setPaymentTab(firstEditable.key);
    setPaymentModal({
      date: row.date,
      paymentId: row.paymentId,
      paymentSealed: row.paymentSealed,
      payment: row.payment,
      paymentNote: row.paymentNote ?? "",
      returnId: row.returnId,
      returnSealed: row.returnSealed,
      return: row.return,
      returnNote: row.returnNote ?? "",
    });
    document.getElementById(PAYMENT_MODAL_ID)?.showModal();
  };

  const savePaymentModal = () => {
    if (!paymentModal || !editing) return;
    const patch = {};
    for (const spec of PAYMENT_SPECS) {
      if (paymentLocked(paymentModal, spec)) continue;
      patch[spec.key] = numOrEmpty(paymentModal[spec.key]);
      patch[spec.noteKey] = paymentModal[spec.noteKey] ?? "";
    }
    updateRow(paymentModal.date, patch);
    document.getElementById(PAYMENT_MODAL_ID)?.close();
  };

  const resetPaymentModal = () => {
    if (!paymentModal) return;
    const initial = initialByDate.get(paymentModal.date);
    const spec = PAYMENT_SPECS.find((item) => item.key === paymentTab);
    if (!initial || !spec) return;
    setPaymentModal((current) => ({
      ...current,
      [spec.key]: initial[spec.key],
      [spec.noteKey]: initial[spec.noteKey] ?? "",
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [];

      for (const row of rows) {
        const initial = initialByDate.get(row.date) ?? row;
        if (
          !row.recordId ||
          row.sealed ||
          !canChangeDailyRecord ||
          !isRecordDirty(row, initial)
        ) {
          continue;
        }
        updates.push({
          id: row.recordId,
          payload: toDailyRecordPatchPayload(row),
        });
      }

      await Promise.all(
        updates.map((item) =>
          updateLabourDailyRecord(labourId, item.id, item.payload),
        ),
      );

      return updates.length;
    },
  });

  const onSave = async () => {
    setApiError(null);
    setSaving(true);
    try {
      const updated = await saveMutation.mutateAsync();
      if (!updated) {
        toastInfo("সেভ করার মতো কোনো পরিবর্তন নেই।");
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ["labours", labourId, "daily-records"],
      });
      setEditing(false);
      toastSuccess("রেকর্ড আপডেট হয়েছে");
    } catch (error) {
      setApiError(parseApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setRows(cloneRows(initialRows));
    setEditing(false);
    setApiError(null);
  };

  const periodLabel = session
    ? `${formatReadableDate(session.start_date)} – ${
        session.end_date ? formatReadableDate(session.end_date) : "চলমান"
      }`
    : "";

  useEffect(() => {
    setTitle?.(periodLabel || "সেশন রেকর্ড");
    return () => setTitle?.("");
  }, [setTitle, periodLabel]);

  useEffect(() => {
    const labourName = labourQuery.data?.name;
    setHeaderMenu?.(
      labourName ? (
        <span className="text-sm font-medium text-base-content/80 truncate px-1 max-w-full">
          {labourName}
        </span>
      ) : null,
    );
    return () => setHeaderMenu?.(null);
  }, [labourQuery.data?.name, setHeaderMenu]);

  if (!canView) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    );
  }

  if (labourQuery.isError || sessionQuery.isError) {
    return (
      <ApiErrorAlert
        error={parseApiError(labourQuery.error || sessionQuery.error)}
      />
    );
  }

  if (
    labourQuery.isLoading ||
    sessionQuery.isLoading ||
    dailyRecordsQuery.isLoading
  ) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        সেশন পাওয়া যায়নি।
      </div>
    );
  }

  if (session.is_modified) {
    return (
      <div className="alert alert-warning text-sm">
        সেশনটি পরিবর্তিত হয়েছে। রেকর্ড দেখা বন্ধ।
      </div>
    );
  }

  const recordsError = dailyRecordsQuery.error;
  const attendanceModalLocked =
    !attendanceModal || attendanceLocked(attendanceModal);

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {apiError ? <ApiErrorAlert error={apiError} /> : null}
      {recordsError ? (
        <ApiErrorAlert error={parseApiError(recordsError)} />
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="table table-fixed table-xs sm:table-sm w-full">
          <colgroup>
            <col className="w-10" />
            <col className="w-[18%]" />
            <col className="w-[23%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-base-200">
            <tr className="border-b">
              <th>নং</th>
              <th>তারিখ</th>
              <th>
                {editing ? (
                  "হাজিরা"
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(HAJIRA_FILTER_MODAL_ID)
                        ?.showModal()
                    }
                  >
                    {filterLabel(HAJIRA_FILTER_OPTIONS, hajiraFilter)}
                  </button>
                )}
              </th>
              <th className="text-right">
                {editing ? (
                  "আয়"
                ) : (
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
                )}
              </th>
              <th className="text-right">
                {editing ? (
                  "পেমেন্ট"
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(PAYMENT_FILTER_MODAL_ID)
                        ?.showModal()
                    }
                  >
                    {filterLabel(PAYMENT_FILTER_OPTIONS, paymentFilter)}
                  </button>
                )}
              </th>
              <th>
                {editing ? (
                  "বিলিং"
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById(BILLING_FILTER_MODAL_ID)
                        ?.showModal()
                    }
                  >
                    {billingFilterHeaderLabel}
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  কোনো রেকর্ড পাওয়া যায়নি।
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const initial = initialByDate.get(row.date) ?? row;
                const attendanceDirty = isAttendanceDirty(row, initial);
                const earnings = rowEarnings(row, viewEarningsFilter);
                const showPayment =
                  viewPaymentFilter !== "return" && num(row.payment) !== 0;
                const showReturn =
                  viewPaymentFilter !== "payment" && num(row.return) !== 0;
                const hajiraValue = hajiraFieldValue(row, viewHajiraFilter);

                return (
                  <tr key={row.date} className="border-b border-base-300/70">
                    <td className="tabular-nums text-base-content/60">
                      {formatBnNumber(index + 1)}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-xs h-auto min-h-0 px-1 font-normal leading-tight ${fieldTone(
                          editing && attendanceDirty,
                        )}`}
                        onClick={() => openAttendanceModal(row)}
                      >
                        {hajiraValue === "combined" ? (
                          <span className="block tabular-nums space-y-0.5">
                            {hasPresent(row) ? (
                              <span className="block">
                                {formatBnNumber(row.present)} ×{" "}
                                {formatBnNumber(row.salary || 0)}
                              </span>
                            ) : null}
                            {hasExtra(row) ? (
                              <span className="block">
                                {formatBnNumber(row.extra)}
                              </span>
                            ) : null}
                          </span>
                        ) : hajiraValue ? (
                          <span className="tabular-nums">{hajiraValue}</span>
                        ) : (
                          "—"
                        )}
                      </button>
                    </td>
                    <td
                      className={`text-right tabular-nums ${fieldTone(
                        editing && attendanceDirty,
                      )}`}
                    >
                      {earnings ? formatBnNumber(earnings) : "—"}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs h-auto min-h-0 px-1 font-normal text-right w-full"
                        onClick={() => openPaymentModal(row)}
                      >
                        {showPayment || showReturn ? (
                          <span className="block tabular-nums space-y-0.5">
                            {showPayment ? (
                              <span
                                className={`block ${
                                  editing &&
                                  isPaymentDirty(row, initial, PAYMENT_SPECS[0])
                                    ? "text-amber-500"
                                    : "text-error"
                                }`}
                              >
                                {formatBnNumber(row.payment)}
                              </span>
                            ) : null}
                            {showReturn ? (
                              <span
                                className={`block ${
                                  editing &&
                                  isPaymentDirty(row, initial, PAYMENT_SPECS[1])
                                    ? "text-amber-500"
                                    : "text-success"
                                }`}
                              >
                                {formatBnNumber(row.return)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-base-content/60">—</span>
                        )}
                      </button>
                    </td>
                    <td>
                      {editing && !attendanceLocked(row) ? (
                        <button
                          type="button"
                          className={`btn btn-ghost btn-xs h-auto min-h-0 px-1 font-normal ${fieldTone(
                            attendanceDirty,
                          )}`}
                          onClick={() =>
                            openBillingModal({
                              date: row.date,
                              siteId: row.siteId,
                              value: row.billing,
                              source: "row",
                            })
                          }
                          title={billingFullLabel(row.billing)}
                        >
                          {billingLabel(row.billing)}
                        </button>
                      ) : (
                        <span
                          className="text-sm text-base-content/70"
                          title={billingFullLabel(row.billing)}
                        >
                          {billingLabel(row.billing)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-base-300 bg-base-200">
        <table className="table table-fixed table-xs sm:table-sm w-full">
          <colgroup>
            <col className="w-10" />
            <col className="w-[18%]" />
            <col className="w-[23%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col />
          </colgroup>
          <tbody>
            <tr className="font-semibold">
              <td colSpan={2}>মোট</td>
              <td className="tabular-nums">{formatBnNumber(totals.present)}</td>
              <td className="text-right tabular-nums">
                {formatBnNumber(totals.earnings)}
              </td>
              <td className="text-right tabular-nums">
                {totals.payment || totals.return ? (
                  <span className="block space-y-0.5">
                    {totals.payment ? (
                      <span className="block text-error">
                        {formatBnNumber(totals.payment)}
                      </span>
                    ) : null}
                    {totals.return ? (
                      <span className="block text-success">
                        {formatBnNumber(totals.return)}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        {canEditRecords ? (
          <div className="flex justify-end gap-2 px-2 py-2">
            {editing ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onCancel}
                  disabled={saving}
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onSave}
                  disabled={saving || !isDirty}
                >
                  {saving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  সেভ
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setEditing(true)}
              >
                এডিট
              </button>
            )}
          </div>
        ) : null}
      </div>

      <dialog
        id={ATTENDANCE_MODAL_ID}
        className="modal"
        onClose={() => setAttendanceModal(null)}
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
            হাজিরা ({formatDate(attendanceModal?.date)})
          </h3>
          {attendanceModal ? (
            <div className="space-y-3 pt-3">
              <label className="form-control w-full">
                <span className="label-text text-sm">হাজিরা</span>
                <select
                  className="select select-bordered select-sm w-full"
                  value={attendanceModal.present}
                  disabled={attendanceModalLocked}
                  onChange={(event) =>
                    setAttendanceModal((current) => ({
                      ...current,
                      present: event.target.value,
                    }))
                  }
                >
                  <option value="">—</option>
                  {PRESENT_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control w-full">
                <span className="label-text text-sm">বেতন</span>
                <input
                  type="number"
                  min={0}
                  className="input input-bordered input-sm w-full"
                  value={attendanceModal.salary}
                  disabled={attendanceModalLocked}
                  onChange={(event) =>
                    setAttendanceModal((current) => ({
                      ...current,
                      salary: numOrEmpty(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text text-sm">বাড়তি</span>
                <input
                  type="number"
                  min={0}
                  className="input input-bordered input-sm w-full"
                  value={attendanceModal.extra}
                  disabled={attendanceModalLocked}
                  onChange={(event) =>
                    setAttendanceModal((current) => ({
                      ...current,
                      extra: numOrEmpty(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text text-sm">নোট</span>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={attendanceModal.note}
                  disabled={attendanceModalLocked}
                  onChange={(event) =>
                    setAttendanceModal((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  maxLength={255}
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text text-sm">বিলিং</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm w-full justify-between font-normal"
                  disabled={attendanceModalLocked}
                  onClick={() =>
                    openBillingModal({
                      date: attendanceModal.date,
                      siteId: attendanceModal.siteId,
                      value: attendanceModal.billing,
                      source: "attendance",
                    })
                  }
                >
                  <span className="truncate">
                    {billingFullLabel(attendanceModal.billing)}
                  </span>
                </button>
              </label>
              {editing ? (
                <div className="modal-action justify-between">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={resetAttendanceModal}
                    disabled={attendanceModalLocked}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={saveAttendanceModal}
                    disabled={attendanceModalLocked}
                  >
                    Save
                  </button>
                </div>
              ) : null}
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
            পেমেন্ট ({formatDate(paymentModal?.date)})
          </h3>
          {paymentModal ? (
            <div className="space-y-3 pt-3">
              <div role="tablist" className="tabs tabs-bordered">
                {PAYMENT_SPECS.map((spec) => (
                  <button
                    key={spec.key}
                    type="button"
                    role="tab"
                    className={`tab ${
                      paymentTab === spec.key ? "tab-active" : ""
                    }`}
                    onClick={() => setPaymentTab(spec.key)}
                  >
                    {spec.label}
                  </button>
                ))}
              </div>
              {PAYMENT_SPECS.filter((spec) => spec.key === paymentTab).map(
                (spec) => {
                  const locked = paymentLocked(paymentModal, spec);
                  return (
                    <div key={spec.key} className="space-y-3">
                      <label className="form-control w-full">
                        <span className="label-text text-sm">নোট</span>
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full"
                          value={paymentModal[spec.noteKey]}
                          disabled={locked}
                          onChange={(event) =>
                            setPaymentModal((current) => ({
                              ...current,
                              [spec.noteKey]: event.target.value,
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
                          className="input input-bordered input-sm w-full"
                          value={paymentModal[spec.key]}
                          disabled={locked}
                          onChange={(event) =>
                            setPaymentModal((current) => ({
                              ...current,
                              [spec.key]: numOrEmpty(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                  );
                },
              )}
              {editing ? (
                <div className="modal-action justify-between">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={resetPaymentModal}
                    disabled={PAYMENT_SPECS.some(
                      (spec) =>
                        spec.key === paymentTab &&
                        paymentLocked(paymentModal, spec),
                    )}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={savePaymentModal}
                  >
                    Save
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </dialog>

      <dialog
        id={BILLING_MODAL_ID}
        className="modal"
        onClose={() => setBillingModal(null)}
      >
        <div className="modal-box max-w-xs">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg">বিলিং</h3>
          <div className="menu bg-base-100 w-full p-0 pt-3">
            <button
              type="button"
              className={`btn btn-ghost btn-sm justify-start ${
                !billingModal?.value ? "btn-active" : ""
              }`}
              onClick={() => pickBilling("")}
            >
              {NULL_BILLING_LABEL}
            </button>
            {(
              billingBySite.get(String(billingModal?.siteId ?? "")) ?? []
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                className={`btn btn-ghost btn-sm justify-start ${
                  String(billingModal?.value) === String(option.id)
                    ? "btn-active"
                    : ""
                }`}
                onClick={() => pickBilling(String(option.id))}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <FilterDialog
        id={HAJIRA_FILTER_MODAL_ID}
        title="হাজিরা ফিল্টার"
        options={HAJIRA_FILTER_OPTIONS}
        value={hajiraFilter}
        onChange={setHajiraFilter}
      />
      <FilterDialog
        id={EARNINGS_FILTER_MODAL_ID}
        title="আয় ফিল্টার"
        options={EARNINGS_FILTER_OPTIONS}
        value={earningsFilter}
        onChange={setEarningsFilter}
      />
      <FilterDialog
        id={PAYMENT_FILTER_MODAL_ID}
        title="পেমেন্ট ফিল্টার"
        options={PAYMENT_FILTER_OPTIONS}
        value={paymentFilter}
        onChange={setPaymentFilter}
      />
      <FilterDialog
        id={BILLING_FILTER_MODAL_ID}
        title="বিলিং ফিল্টার"
        options={billingFilterOptions}
        value={billingFilter}
        onChange={setBillingFilter}
      />
    </div>
  );
};

const FilterDialog = ({ id, title, options, value, onChange }) => (
  <dialog id={id} className="modal">
    <div className="modal-box max-w-xs">
      <form method="dialog">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          aria-label="বন্ধ"
        >
          ✕
        </button>
      </form>
      <h3 className="font-bold text-lg">{title}</h3>
      <div className="menu bg-base-100 w-full p-0 pt-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`btn btn-ghost btn-sm justify-start ${
              value === option.value ? "btn-active" : ""
            }`}
            onClick={() => {
              onChange(option.value);
              document.getElementById(id)?.close();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
    <form method="dialog" className="modal-backdrop">
      <button type="submit">close</button>
    </form>
  </dialog>
);
