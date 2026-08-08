import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchAllActivities } from "../../api/activities.js";
import {
  fetchLabourDailyRecords,
  fetchLabourDetail,
  fetchLabourLatestSession,
  fetchLabourRunningSession,
  fetchLabourSession,
} from "../../api/labours.js";
import { fetchActiveBillingCategories } from "../../api/sites.js";
import {
  activityTextToneClass,
  activityToneClass,
  applyActivitiesToSessionRows,
} from "../../api/types/activity.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import {
  DailyRecordHistoryPanel,
  RECORD_LOG_FIELD_LABELS,
  summarizeDailyRecordLog,
} from "../../components/DailyRecordHistoryPanel.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import {
  concatBillingName,
  formatBnNumber,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import { PERMS, hasPermissionSuffix } from "../../utils/permissions.js";

const RECORD_MODAL_ID = "session_record_detail_modal";
const EARNINGS_FILTER_MODAL_ID = "session_record_earnings_filter_modal";
const PAYMENT_FILTER_MODAL_ID = "session_record_payment_filter_modal";
const BILLING_FILTER_MODAL_ID = "session_record_billing_filter_modal";
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
  const { can, profile } = usePermissions();
  const isRunningRoute = sessionId === "running";
  const isLatestRoute = sessionId === "latest";
  const canView = can(PERMS.viewLabourSession);
  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, "view_activitylog");

  const [earningsFilter, setEarningsFilter] = useState("earn");
  const [paymentFilter, setPaymentFilter] = useState([
    "payment",
    "advance",
    "return",
  ]);
  const [billingFilter, setBillingFilter] = useState("all");
  const [hajiraFilter, setHajiraFilter] = useState(["present", "extra"]);
  const [recordModal, setRecordModal] = useState(null);
  const [recordModalView, setRecordModalView] = useState(MODAL_VIEWS.detail);
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
    if (id == null || id === "") return concatBillingName(NULL_BILLING_LABEL);
    const full = billingNameById.get(String(id));
    if (!full) return `#${id}`;
    return concatBillingName(full);
  };

  const billingFilterOptions = useMemo(() => {
    const options = [
      { value: "all", label: "সব" },
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

  const visibleRows = useMemo(() => {
    if (billingFilter === "all") return rows;
    if (billingFilter === "none") {
      return rows.filter((row) => row.billing == null || row.billing === "");
    }
    return rows.filter(
      (row) => String(row.billing ?? "") === String(billingFilter),
    );
  }, [rows, billingFilter]);

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

  const openRecordModal = (row) => {
    setRecordModalView(MODAL_VIEWS.detail);
    setExpandedHistoryId(null);
    setRecordModal({
      date: row.date,
      recordId: row.recordId,
      present: row.present === "" || row.present == null ? "" : String(row.present),
      salary: row.salary,
      extra: row.extra || "",
      note: row.extraNote ?? "",
      billing: row.billing ?? "",
      payment: row.payment,
      advance: row.advance,
      return: row.return,
    });
    document.getElementById(RECORD_MODAL_ID)?.showModal();
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

  const recordsError = dailyRecordsQuery.error || activitiesQuery.error;

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {recordsError ? (
        <ApiErrorAlert error={parseApiError(recordsError)} />
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="table table-sm sm:table-md w-full">
          <thead className="sticky top-0 z-10 bg-base-100">
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
                    document
                      .getElementById(EARNINGS_FILTER_MODAL_ID)
                      ?.showModal()
                  }
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
              <th className="text-right">
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
                const earnings = rowEarnings(row, earningsFilter);
                const showPay =
                  paymentFilter.includes("payment") && num(row.payment) !== 0;
                const showAdv =
                  paymentFilter.includes("advance") && num(row.advance) !== 0;
                const showRet =
                  paymentFilter.includes("return") && num(row.return) !== 0;
                const attendanceLines = attendanceCellLines(row, hajiraFilter);
                const hajiraTone =
                  activityTextToneClass(row.activityTone) ||
                  "text-base-content/70";

                return (
                  <tr
                    key={row.date}
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
                    <td className="whitespace-nowrap">{formatDate(row.date)}</td>
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
                      </span>
                    </td>
                    <td className="text-right tabular-nums">
                      {earnings ? formatBnNumber(earnings) : "—"}
                    </td>
                    <td className="text-right">
                      {showPay || showAdv || showRet ? (
                        <span className="block w-full tabular-nums space-y-0.5 text-right">
                          {showPay ? (
                            <span className="block w-full text-right text-error">
                              {formatBnNumber(row.payment)}
                            </span>
                          ) : null}
                          {showAdv ? (
                            <span className="block w-full text-right text-error">
                              {formatBnNumber(row.advance)}
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
                    <td
                      className="text-right text-sm whitespace-nowrap"
                      title={billingFullLabel(row.billing)}
                    >
                      {billingLabel(row.billing)}
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
                <td className="text-right text-base-content/60">—</td>
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
            {recordModal && canShowRecordHistory ? (
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
                  হিস্ট্রি
                </button>
              </div>
            ) : recordModal ? (
              `হাজিরা (${formatDate(recordModal.date)})`
            ) : (
              "হাজিরা"
            )}
          </h3>

          <div className="flex-1 min-h-0 overflow-y-auto">
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
                <div className="text-sm text-base-content/60">
                  তারিখ:{" "}
                  <span className="text-base-content font-medium">
                    {formatDate(recordModal.date)}
                  </span>
                </div>
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
                    {billingFullLabel(recordModal.billing)}
                  </div>
                </div>
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
      <FilterDialog
        id={EARNINGS_FILTER_MODAL_ID}
        title="আয় ফিল্টার"
        options={EARNINGS_FILTER_OPTIONS}
        value={earningsFilter}
        onChange={(value) => {
          setEarningsFilter(value);
          document.getElementById(EARNINGS_FILTER_MODAL_ID)?.close();
        }}
      />
      <MultiFilterDialog
        id={PAYMENT_FILTER_MODAL_ID}
        title="লেনদেন"
        options={PAYMENT_FILTER_OPTIONS}
        values={paymentFilter}
        onChange={setPaymentFilter}
      />
      <FilterDialog
        id={BILLING_FILTER_MODAL_ID}
        title="বিলিং ফিল্টার"
        options={billingFilterOptions}
        value={billingFilter}
        onChange={(value) => {
          setBillingFilter(value);
          document.getElementById(BILLING_FILTER_MODAL_ID)?.close();
        }}
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
            onClick={() => onChange(option.value)}
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
