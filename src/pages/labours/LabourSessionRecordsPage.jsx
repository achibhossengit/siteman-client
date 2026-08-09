import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { fetchAllActivities } from "../../api/activities.js";
import {
  deleteLabourDailyRecord,
  fetchLabourDailyRecords,
  fetchLabourDetail,
  fetchLabourLatestSession,
  fetchLabourRunningSession,
  fetchLabourSession,
  updateLabourDailyRecord,
} from "../../api/labours.js";
import { fetchActiveBillingCategories } from "../../api/sites.js";
import {
  activityTextToneClass,
  activityToneClass,
  applyActivitiesToSessionRows,
} from "../../api/types/activity.js";
import {
  PRESENT_OPTIONS,
  toDailyRecordPatchPayload,
} from "../../api/types/hajira.js";
import { normalizeSiteIds } from "../../api/types/user.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import {
  DailyRecordHistoryPanel,
  RECORD_LOG_FIELD_LABELS,
  summarizeDailyRecordLog,
} from "../../components/DailyRecordHistoryPanel.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { useSitesLookup } from "../../hooks/useSites.js";
import {
  concatBillingName,
  formatBnNumber,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import { confirmAction, toastSuccess } from "../../utils/feedback.js";
import { PERMS, hasPermissionSuffix } from "../../utils/permissions.js";

const RECORD_MODAL_ID = "session_record_detail_modal";
const PAYMENT_FILTER_MODAL_ID = "session_record_payment_filter_modal";
const HAJIRA_FILTER_MODAL_ID = "session_record_hajira_filter_modal";

const MODAL_VIEWS = {
  detail: "detail",
  history: "history",
};

const HAJIRA_FILTER_OPTIONS = [
  { value: "present", label: "উপস্থিতি" },
  { value: "salary", label: "বেতন" },
  { value: "extra", label: "বাড়তি" },
];

const EARNINGS_FILTER_OPTIONS = [
  { value: "earn", label: "আয়" },
  { value: "from_present", label: "বেতন" },
  { value: "from_extra", label: "বাড়তি" },
];

const nextEarningsFilter = (value) => {
  const idx = EARNINGS_FILTER_OPTIONS.findIndex((opt) => opt.value === value);
  const next = EARNINGS_FILTER_OPTIONS[(idx + 1) % EARNINGS_FILTER_OPTIONS.length];
  return next?.value ?? "earn";
};

const PAYMENT_FILTER_OPTIONS = [
  { value: "payment", label: "ফুডিং" },
  { value: "advance", label: "অ্যাডভান্স" },
  { value: "return", label: "রিটার্ন" },
];

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
      attendanceId: recordId,
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
      billingName: record.billing_name ?? null,
      payment: numOrEmpty(record.fooding_pay),
      advance: numOrEmpty(record.advance_pay),
      return: numOrEmpty(record.return_amount),
    });
  }

  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

const hasPresent = (row) => row.present !== "" && row.present != null;
const hasExtra = (row) => num(row.extra) > 0;

const presentEarnings = (row) =>
  (hasPresent(row) ? Number(row.present) : 0) * num(row.salary);

const rowEarnings = (row, filter = "earn") => {
  const fromPresent = presentEarnings(row);
  const fromExtra = num(row.extra);
  if (filter === "from_present") return fromPresent;
  if (filter === "from_extra") return fromExtra;
  return fromPresent + fromExtra;
};

const attendanceCellLines = (row, selectedFields) => {
  const lines = [];
  if (selectedFields.includes("present") && hasPresent(row)) {
    lines.push({ key: "present", value: formatBnNumber(row.present) });
  }
  if (
    selectedFields.includes("salary") &&
    row.salary !== "" &&
    row.salary != null
  ) {
    lines.push({ key: "salary", value: formatBnNumber(row.salary) });
  }
  if (selectedFields.includes("extra") && hasExtra(row)) {
    lines.push({ key: "extra", value: formatBnNumber(row.extra) });
  }
  return lines.length ? lines : [{ key: "empty", value: "—" }];
};

const hajiraTotalValue = (row, hajiraFields) => {
  if (hajiraFields.includes("present")) return num(row.present);
  if (hajiraFields.includes("salary")) return num(row.salary);
  if (hajiraFields.includes("extra")) return num(row.extra);
  return num(row.present);
};

const fetchAllLabourDailyRecords = async (labourId, rangeParams) => {
  const results = [];
  let page = 1;
  for (;;) {
    const { data } = await fetchLabourDailyRecords(labourId, {
      ...rangeParams,
      page,
      page_size: 100,
    });
    const chunk = data?.results ?? [];
    results.push(...chunk);
    if (!data?.next) break;
    page += 1;
    if (page > 200) break;
  }
  return results;
};

export const LabourSessionRecordsPage = () => {
  const { labourId, sessionId } = useParams();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const queryClient = useQueryClient();
  const { can, profile } = usePermissions();
  const isRunningRoute = sessionId === "running";
  const isLatestRoute = sessionId === "latest";
  const canView = can(PERMS.viewLabourSession);
  const { getSiteName } = useSitesLookup({ enabled: canView });
  const canChangeDailyRecord = can(PERMS.changeDailyRecord);
  const canDeleteDailyRecord = can(PERMS.deleteDailyRecord);
  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, "view_activitylog");

  const allowedSiteIds = useMemo(
    () => new Set(normalizeSiteIds(profile?.sites).map(String)),
    [profile?.sites],
  );

  const [earningsFilter, setEarningsFilter] = useState("earn");
  const [paymentFilter, setPaymentFilter] = useState([
    "payment",
    "advance",
    "return",
  ]);
  const [billingFilter, setBillingFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [hajiraFilter, setHajiraFilter] = useState(["present", "extra"]);
  const [recordModal, setRecordModal] = useState(null);
  const [recordModalView, setRecordModalView] = useState(MODAL_VIEWS.detail);
  const [modalEditing, setModalEditing] = useState(false);
  const [modalSnapshot, setModalSnapshot] = useState(null);
  const [modalApiError, setModalApiError] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

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
    queryKey: ["labours", labourId, "daily-records", sessionId, rangeParams],
    queryFn: () => fetchAllLabourDailyRecords(labourId, rangeParams),
    enabled: recordsEnabled,
  });

  const activitiesQuery = useQuery({
    queryKey: [
      "activities",
      "session-records",
      labourId,
      session?.start_date,
      session?.end_date,
    ],
    queryFn: () =>
      fetchAllActivities({
        labour: labourId,
        entity_type: "daily_record",
        reviewed: false,
        business_date__gte: session.start_date,
        ...(session.end_date
          ? { business_date__lte: session.end_date }
          : {}),
        page_size: 100,
      }),
    enabled: Boolean(recordsEnabled && canViewActivityLog && session?.start_date),
  });

  const rows = useMemo(() => {
    const base = buildRows(dailyRecordsQuery.data ?? []);
    if (!canViewActivityLog) return base;
    return applyActivitiesToSessionRows(base, activitiesQuery.data ?? []);
  }, [dailyRecordsQuery.data, activitiesQuery.data, canViewActivityLog]);

  const billingFullLabel = (id) => {
    if (id == null || id === "") return NULL_BILLING_LABEL;
    const fromRow = rows.find((row) => String(row.billing) === String(id));
    if (fromRow?.billingName) return fromRow.billingName;
    return `#${id}`;
  };

  const billingFullLabelForRow = (row) => {
    if (row?.billing == null || row.billing === "") return NULL_BILLING_LABEL;
    if (row.billingName) return row.billingName;
    return `#${row.billing}`;
  };

  const billingLabelForRow = (row) =>
    concatBillingName(billingFullLabelForRow(row));

  const billingFilterOptions = useMemo(() => {
    const options = [
      { value: "all", label: "সব বিলিং" },
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
        label: row.billingName || `#${value}`,
      });
    }
    return options;
  }, [rows]);

  const siteFilterOptions = useMemo(() => {
    const options = [{ value: "all", label: "সব সাইট" }];
    const seen = new Set();
    for (const row of rows) {
      if (row.siteId == null || row.siteId === "") continue;
      const value = String(row.siteId);
      if (seen.has(value)) continue;
      seen.add(value);
      options.push({
        value,
        label: getSiteName(row.siteId),
      });
    }
    return options;
  }, [rows, getSiteName]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (
        siteFilter !== "all" &&
        String(row.siteId ?? "") !== String(siteFilter)
      ) {
        return false;
      }
      if (billingFilter === "all") return true;
      if (billingFilter === "none") {
        return row.billing == null || row.billing === "";
      }
      return String(row.billing ?? "") === String(billingFilter);
    });
  }, [rows, siteFilter, billingFilter]);

  const totals = useMemo(
    () =>
      visibleRows.reduce(
        (result, row) => {
          result.present += hajiraTotalValue(row, hajiraFilter);
          result.earnings += rowEarnings(row, earningsFilter);
          if (paymentFilter.includes("payment")) {
            result.payment += num(row.payment);
          }
          if (paymentFilter.includes("advance")) {
            result.advance += num(row.advance);
          }
          if (paymentFilter.includes("return")) {
            result.return += num(row.return);
          }
          return result;
        },
        { present: 0, earnings: 0, payment: 0, advance: 0, return: 0 },
      ),
    [visibleRows, earningsFilter, paymentFilter, hajiraFilter],
  );

  const historyQuery = useQuery({
    queryKey: [
      "activities",
      "daily_record",
      recordModal?.recordId,
      labourId,
    ],
    queryFn: () =>
      fetchAllActivities({
        labour: labourId,
        entity_type: "daily_record",
        entity_id: recordModal.recordId,
        page_size: 100,
      }),
    enabled: Boolean(
      canViewActivityLog &&
        recordModal?.recordId &&
        recordModalView === MODAL_VIEWS.history,
    ),
  });

  const recordHistoryLogs = useMemo(() => {
    const logs = historyQuery.data ?? [];
    return [...logs].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [historyQuery.data]);

  const canShowRecordHistory = Boolean(
    canViewActivityLog && recordModal?.recordId,
  );

  const isSiteAllowed = (siteId) => {
    if (siteId == null || siteId === "") return false;
    return allowedSiteIds.has(String(siteId));
  };

  const recordActionsEnabled = Boolean(
    recordModal?.recordId &&
      !recordModal?.sealed &&
      isSiteAllowed(recordModal?.siteId),
  );
  const canUpdateRecord = recordActionsEnabled && canChangeDailyRecord;
  const canDeleteRecord = recordActionsEnabled && canDeleteDailyRecord;

  const activeBillingQuery = useQuery({
    queryKey: ["sites", recordModal?.siteId, "active-billing"],
    queryFn: async () => {
      const { data } = await fetchActiveBillingCategories(recordModal.siteId);
      return data;
    },
    enabled: Boolean(modalEditing && recordModal?.siteId),
  });

  const billingOptions = useMemo(() => {
    const opts = [...(activeBillingQuery.data ?? [])];
    const cur = recordModal?.billing;
    if (
      cur !== "" &&
      cur != null &&
      !opts.some((b) => String(b.id) === String(cur))
    ) {
      opts.unshift({
        id: cur,
        name: recordModal?.billingName || billingFullLabel(cur),
      });
    }
    return opts;
  }, [activeBillingQuery.data, recordModal?.billing, recordModal?.billingName, rows]);

  const invalidateRecordQueries = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["labours", labourId, "daily-records"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["activities", "session-records", labourId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["labours", labourId, "session-detail", sessionId],
    });
  };

  const updateMutation = useMutation({
    mutationFn: ({ recordId, payload }) =>
      updateLabourDailyRecord(labourId, recordId, payload),
  });

  const deleteMutation = useMutation({
    mutationFn: (recordId) => deleteLabourDailyRecord(labourId, recordId),
  });

  const closeRecordModal = () => {
    document.getElementById(RECORD_MODAL_ID)?.close();
  };

  const resetModalEditState = () => {
    setModalEditing(false);
    setModalSnapshot(null);
    setModalApiError(null);
  };

  const openRecordModal = (row) => {
    setRecordModalView(MODAL_VIEWS.detail);
    setExpandedHistoryId(null);
    resetModalEditState();
    setRecordModal({
      date: row.date,
      recordId: row.recordId,
      sealed: Boolean(row.sealed),
      siteId: row.siteId,
      present:
        row.present === "" || row.present == null ? "" : String(row.present),
      salary: row.salary,
      extra: row.extra || "",
      note: row.extraNote ?? "",
      billing: row.billing ?? "",
      billingName: row.billingName ?? null,
      payment: row.payment,
      advance: row.advance,
      return: row.return,
    });
    document.getElementById(RECORD_MODAL_ID)?.showModal();
  };

  const startModalEdit = () => {
    if (!canUpdateRecord || !recordModal) return;
    setModalApiError(null);
    setModalSnapshot({ ...recordModal });
    setModalEditing(true);
  };

  const cancelModalEdit = () => {
    if (modalSnapshot) setRecordModal(modalSnapshot);
    resetModalEditState();
  };

  const saveModalEdit = async () => {
    if (!canUpdateRecord || !recordModal?.recordId) return;
    setModalApiError(null);
    try {
      await updateMutation.mutateAsync({
        recordId: recordModal.recordId,
        payload: toDailyRecordPatchPayload({
          labourId,
          present: recordModal.present,
          salary: recordModal.salary,
          extra: recordModal.extra,
          extraNote: recordModal.note,
          billing: recordModal.billing,
          payment: recordModal.payment,
          advance: recordModal.advance,
          return: recordModal.return,
        }),
      });
      await invalidateRecordQueries();
      toastSuccess("রেকর্ড আপডেট হয়েছে");
      resetModalEditState();
      closeRecordModal();
    } catch (error) {
      setModalApiError(parseApiError(error));
    }
  };

  const onDeleteRecord = async () => {
    if (!canDeleteRecord || !recordModal?.recordId) return;
    const confirmed = await confirmAction({
      title: "রেকর্ড মুছে ফেলবেন?",
      text: "এই কাজটি ফিরিয়ে আনা যাবে না।",
      confirmText: "ডিলিট করুন",
      danger: true,
    });
    if (!confirmed) return;
    setModalApiError(null);
    try {
      await deleteMutation.mutateAsync(recordModal.recordId);
      await invalidateRecordQueries();
      toastSuccess("রেকর্ড ডিলিট হয়েছে");
      resetModalEditState();
      closeRecordModal();
    } catch (error) {
      setModalApiError(parseApiError(error));
    }
  };

  const displayValue = (value) => {
    if (value === "" || value == null) return "—";
    return formatBnNumber(value);
  };

  const periodLabel = session
    ? `${formatReadableDate(session.start_date)} – ${
        session.end_date ? formatReadableDate(session.end_date) : "চলমান"
      }`
    : "";

  useEffect(() => {
    setTitle?.(periodLabel || "হিসাব রেকর্ড");
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
    dailyRecordsQuery.isLoading ||
    activitiesQuery.isLoading
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
        হিসাব পাওয়া যায়নি।
      </div>
    );
  }

  if (session.is_modified) {
    return (
      <div className="alert alert-warning text-sm">
        হিসাবটি পরিবর্তিত হয়েছে। রেকর্ড দেখা বন্ধ।
      </div>
    );
  }

  const recordsError = dailyRecordsQuery.error || activitiesQuery.error;

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {recordsError ? (
        <ApiErrorAlert error={parseApiError(recordsError)} />
      ) : null}

      <div className="flex justify-between items-center gap-2 shrink-0">
        <select
          className="select select-bordered select-sm min-w-36"
          value={billingFilter}
          onChange={(e) => setBillingFilter(e.target.value)}
          aria-label="বিলিং ফিল্টার"
        >
          {billingFilterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm min-w-36"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          aria-label="সাইট ফিল্টার"
        >
          {siteFilterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="table table-sm sm:table-md w-full bg-transparent [&_th]:px-0 [&_td]:px-0">
          <thead className="sticky top-0 z-10 bg-base-200">
            <tr className="border-b border-base-300 text-sm">
              <th>নং</th>
              <th>তারিখ</th>
              <th className="text-right">
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById(HAJIRA_FILTER_MODAL_ID)?.showModal()
                  }
                >
                  হাজিরা
                </button>
              </th>
              <th className="text-right">
                <button
                  type="button"
                  onClick={() =>
                    setEarningsFilter((prev) => nextEarningsFilter(prev))
                  }
                  title="ক্লিক করে আয় / বেতন / বাড়তি বদলান"
                >
                  {filterLabel(EARNINGS_FILTER_OPTIONS, earningsFilter)}
                </button>
              </th>
              <th className="text-right">
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
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  কোনো রেকর্ড পাওয়া যায়নি।
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const earnings = rowEarnings(row, earningsFilter);
                const outflow =
                  (paymentFilter.includes("payment") ? num(row.payment) : 0) +
                  (paymentFilter.includes("advance") ? num(row.advance) : 0);
                const showOutflow = outflow !== 0;
                const showRet =
                  paymentFilter.includes("return") && num(row.return) !== 0;
                const attendanceLines = attendanceCellLines(row, hajiraFilter);
                const hajiraTone =
                  activityTextToneClass(row.activityTone) ||
                  "text-base-content/70";
                const billingText = billingLabelForRow(row);

                return (
                  <tr
                    key={`${row.date}-${row.siteId ?? ""}-${row.recordId ?? index}`}
                    className={[
                      "border-b border-base-300/70 cursor-pointer",
                      activityToneClass(row.activityTone),
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => openRecordModal(row)}
                  >
                    <td className="tabular-nums text-base-content/60">
                      {formatBnNumber(index + 1)}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="block leading-tight">
                        <span>{formatDate(row.date)}</span>
                        {row.siteId != null && row.siteId !== "" ? (
                          <span
                            className="block text-xs text-base-content/60 truncate max-w-28"
                            title={getSiteName(row.siteId)}
                          >
                            {getSiteName(row.siteId)}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className={`text-right ${hajiraTone}`}>
                      <span className="block w-full space-y-0.5 text-right leading-tight">
                        {attendanceLines.map((line) => (
                          <span
                            key={line.key}
                            className="block w-full truncate text-right tabular-nums"
                            title={line.value}
                          >
                            {line.value}
                          </span>
                        ))}
                        <span
                          className="block w-full truncate text-right text-xs text-base-content/60"
                          title={billingFullLabelForRow(row)}
                        >
                          {billingText}
                        </span>
                      </span>
                    </td>
                    <td className="text-right tabular-nums">
                      {earnings ? formatBnNumber(earnings) : "—"}
                    </td>
                    <td className="text-right">
                      {showOutflow || showRet ? (
                        <span className="block w-full tabular-nums space-y-0.5 text-right">
                          {showOutflow ? (
                            <span className="block w-full text-right text-error">
                              {formatBnNumber(outflow)}
                            </span>
                          ) : null}
                          {showRet ? (
                            <span className="block w-full text-right text-success">
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
                <td className="text-right tabular-nums">
                  {totals.earnings ? formatBnNumber(totals.earnings) : "—"}
                </td>
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
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

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
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8">
            {recordModal && canShowRecordHistory ? (
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
                  হিস্ট্রি
                </button>
              </div>
            ) : recordModal ? (
              `হাজিরা (${formatDate(recordModal.date)})`
            ) : (
              "হাজিরা"
            )}
          </h3>

          <div>
            {recordModal &&
            recordModalView === MODAL_VIEWS.history &&
            canShowRecordHistory ? (
              <DailyRecordHistoryPanel
                isLoading={historyQuery.isLoading}
                error={historyQuery.isError ? historyQuery.error : null}
                logs={recordHistoryLogs}
                expandedId={expandedHistoryId}
                setExpandedId={setExpandedHistoryId}
                fieldLabels={RECORD_LOG_FIELD_LABELS}
                billingNameFn={billingFullLabel}
                summarize={summarizeDailyRecordLog}
              />
            ) : recordModal ? (
              <div className="space-y-3">
                {modalApiError ? (
                  <ApiErrorAlert error={modalApiError} />
                ) : null}
                <div className="text-sm text-base-content/60 space-y-0.5">
                  <div>
                    তারিখ:{" "}
                    <span className="text-base-content font-medium">
                      {formatDate(recordModal.date)}
                    </span>
                  </div>
                  {recordModal.siteId != null && recordModal.siteId !== "" ? (
                    <div>
                      সাইট:{" "}
                      <span className="text-base-content font-medium">
                        {getSiteName(recordModal.siteId)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {modalEditing ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="form-control w-full min-w-0">
                        <span className="label-text text-sm">হাজিরা</span>
                        <select
                          className="select select-bordered select-sm w-full"
                          value={recordModal.present}
                          onChange={(e) =>
                            setRecordModal((m) => ({
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
                      <label className="form-control w-full min-w-0">
                        <span className="label-text text-sm">বেতন</span>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-full tabular-nums"
                          value={recordModal.salary}
                          onChange={(e) =>
                            setRecordModal((m) => ({
                              ...m,
                              salary: numOrEmpty(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="form-control w-full min-w-0">
                        <span className="label-text text-sm">বাড়তি</span>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-full tabular-nums"
                          value={recordModal.extra}
                          onChange={(e) =>
                            setRecordModal((m) => ({
                              ...m,
                              extra: numOrEmpty(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="form-control w-full min-w-0">
                        <span className="label-text text-sm">ফুডিং</span>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered input-sm w-full tabular-nums"
                          value={recordModal.payment}
                          onChange={(e) =>
                            setRecordModal((m) => ({
                              ...m,
                              payment: numOrEmpty(e.target.value),
                            }))
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
                          onChange={(e) =>
                            setRecordModal((m) => ({
                              ...m,
                              advance: numOrEmpty(e.target.value),
                            }))
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
                          onChange={(e) =>
                            setRecordModal((m) => ({
                              ...m,
                              return: numOrEmpty(e.target.value),
                            }))
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
                        maxLength={255}
                        onChange={(e) =>
                          setRecordModal((m) => ({
                            ...m,
                            note: e.target.value,
                          }))
                        }
                      />
                    </label>
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
                        onChange={(e) => {
                          const nextId = e.target.value;
                          const opt = billingOptions.find(
                            (b) => String(b.id) === String(nextId),
                          );
                          setRecordModal((m) => ({
                            ...m,
                            billing: nextId,
                            billingName:
                              nextId === ""
                                ? null
                                : (opt?.name ?? m.billingName ?? null),
                          }));
                        }}
                      >
                        <option value="">—</option>
                        {billingOptions.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm flex-1"
                        onClick={cancelModalEdit}
                        disabled={updateMutation.isPending}
                      >
                        বাতিল
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm flex-1"
                        onClick={saveModalEdit}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <span className="loading loading-spinner loading-sm" />
                        ) : null}
                        নিশ্চিত
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
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
                          {displayValue(recordModal.salary)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text text-sm">বাড়তি</span>
                        <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                          {displayValue(recordModal.extra)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text text-sm">ফুডিং</span>
                        <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                          {displayValue(recordModal.payment)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text text-sm">অ্যাডভান্স</span>
                        <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                          {displayValue(recordModal.advance)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text text-sm">রিটার্ন</span>
                        <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                          {displayValue(recordModal.return)}
                        </div>
                      </div>
                    </div>
                    <div className="form-control w-full">
                      <span className="label-text text-sm">নোট</span>
                      <div className="min-h-8 flex items-center px-1 text-sm">
                        {recordModal.note?.trim() ? recordModal.note : "—"}
                      </div>
                    </div>
                    <div className="form-control w-full">
                      <span className="label-text text-sm">বিলিং</span>
                      <div className="min-h-8 flex items-center px-1 text-sm">
                        {billingFullLabelForRow(recordModal)}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        className="btn btn-outline btn-primary btn-sm flex-1"
                        disabled={!canUpdateRecord}
                        title={
                          recordModal.sealed
                            ? "রেকর্ড সিল করা আছে"
                            : !isSiteAllowed(recordModal.siteId)
                              ? "এই সাইটে অনুমতি নেই"
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
                        disabled={!canDeleteRecord || deleteMutation.isPending}
                        title={
                          recordModal.sealed
                            ? "রেকর্ড সিল করা আছে"
                            : !isSiteAllowed(recordModal.siteId)
                              ? "এই সাইটে অনুমতি নেই"
                              : !canDeleteDailyRecord
                                ? "ডিলিট অনুমতি নেই"
                                : undefined
                        }
                        onClick={onDeleteRecord}
                      >
                        {deleteMutation.isPending ? (
                          <span className="loading loading-spinner loading-sm" />
                        ) : (
                          <Trash2 className="size-4" strokeWidth={1.75} />
                        )}
                        ডিলিট
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <MultiFilterDialog
        id={HAJIRA_FILTER_MODAL_ID}
        title="হাজিরা"
        options={HAJIRA_FILTER_OPTIONS}
        values={hajiraFilter}
        onChange={setHajiraFilter}
      />
      <MultiFilterDialog
        id={PAYMENT_FILTER_MODAL_ID}
        title="লেনদেন"
        options={PAYMENT_FILTER_OPTIONS}
        values={paymentFilter}
        onChange={setPaymentFilter}
      />
    </div>
  );
};

const MultiFilterDialog = ({ id, title, options, values, onChange }) => (
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
      <div className="pt-3 flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex items-center gap-2 cursor-pointer text-sm"
          >
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={values.includes(option.value)}
              onChange={() => {
                onChange((prev) =>
                  prev.includes(option.value)
                    ? prev.filter((value) => value !== option.value)
                    : [...prev, option.value],
                );
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
    <form method="dialog" className="modal-backdrop">
      <button type="submit">close</button>
    </form>
  </dialog>
);
