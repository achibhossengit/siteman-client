import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { HeaderFilterPopover } from "../../components/HeaderFilterPopover.jsx";
import { fetchAllActivities, reviewActivities } from "../../api/activities.js";
import {
  closeLabourSession,
  deleteLabourDailyRecord,
  deleteLabourSession,
  fetchLabourDailyRecords,
  fetchLabourDetail,
  fetchLabourLatestSession,
  fetchLabourRunningSession,
  fetchLabourSession,
  fetchLabourSessions,
  updateLabourDailyRecord,
} from "../../api/labours.js";
import { fetchAllPages } from "../../api/pagination.js";
import {
  activityCellToneClass,
  applyActivitiesToSessionRows,
  applyPendingActivitiesToHajiraRows,
} from "../../api/types/activity.js";
import {
  PRESENT_OPTIONS,
  toDailyRecordPatchPayload,
} from "../../api/types/hajira.js";
import { profileAllowedSiteIds } from "../../api/types/user.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { DateSelector } from "../../components/DateSelector.jsx";
import { PersonAvatar } from "../../components/PersonAvatar.jsx";
import { SiteSelector } from "../../components/SiteSelector.jsx";
import {
  DailyRecordHistoryPanel,
  RECORD_LOG_FIELD_LABELS,
  summarizeDailyRecordLog,
} from "../../components/DailyRecordHistoryPanel.jsx";
import { HajiraActionBars } from "../../components/hajiraPage/HajiraActionBars.jsx";
import { formatBulkReviewError, sessionPairClass } from "../../components/hajiraPage/helpers.js";
import {
  FitAmount as Amount,
  JoinedAmounts,
  PresentLine,
  RETURN_TONE,
  remainTone,
  remainingOf,
  splitSettlement,
} from "../../components/hajiraPage/JoinedAmounts.jsx";
import { useBillingLookups } from "../../hooks/useBillingLookup.js";
import { usePermissions } from "../../hooks/usePermissions.js";
import { useSitesLookup } from "../../hooks/useSites.js";
import {
  formatBnNumber,
  formatBnSigned,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import { paths } from "../../router/paths.js";
import { confirmAction, toastApiError, toastInfo, toastSuccess } from "../../utils/feedback.js";
import { SHOW_BILLING } from "../../config/features.js";
import { PERMS, hasPermissionSuffix } from "../../utils/permissions.js";
import { ALL_DATES, isAllDates, parseIsoDate, todayIso } from "../../utils/dateRange.js";
import {
  readSessionShowSalary,
  writeSessionShowSalary,
} from "../../utils/sessionSelection.js";

const RECORD_MODAL_ID = "session_record_detail_modal";
const CLOSE_MODAL_ID = "session_close_modal";

const BORDER_Y = "border-b border-b-base-content/35";
const BORDER_Y_SOFT = "border-b border-b-base-content/15";
const BORDER_X = "border-r border-r-base-content/35";
const BORDER_X_INNER = "border-r border-r-base-content/15";
const CELL = `${BORDER_Y} ${BORDER_X}`;
const CELL_TOP = `${BORDER_Y_SOFT} ${BORDER_X}`;
const CELL_TOP_INNER = `${BORDER_Y_SOFT} ${BORDER_X_INNER}`;
const CELL_SUB = `${BORDER_Y} ${BORDER_X}`;
const CELL_SUB_INNER = `${BORDER_Y} ${BORDER_X_INNER}`;
const HEAD_BG = "!bg-base-300";
const ROW_EVEN = "!bg-base-100";
const ROW_ODD = "!bg-base-200";
const FOOT_BG = "!bg-base-300";
const SORBOMOT_BG =
  "!bg-[color-mix(in_oklab,var(--color-base-300),var(--color-base-content)_6%)]";
const VALUE_CELL =
  "text-right align-middle tabular-nums whitespace-nowrap leading-none px-1 !py-px text-xs w-[1%] min-w-14 max-w-24";
const PAIR_COL = "w-[1%] min-w-14";
const PAIR_ROWS = 3;
const ROW2_LEFT = CELL_TOP_INNER;
const ROW2_RIGHT = CELL_TOP;

const signedTone = (value) => remainTone(value);

const cellFill = (row, index) => {
  const activity = activityCellToneClass(row.activityTone);
  if (activity) return activity;
  return index % 2 === 0 ? ROW_EVEN : ROW_ODD;
};

const MODAL_VIEWS = {
  detail: "detail",
  history: "history",
};

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

const CloseWarnDate = ({ iso }) => (
  <span className="font-bold text-base-content/60">{formatDate(iso)}</span>
);

const formatReadableDate = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
  }).format(date);
};

const toIsoDate = (value) => {
  if (value == null || value === "") return "";
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
};

const readDateRangeFromSearch = (params) => {
  const start = toIsoDate(params.get("start"));
  const end = toIsoDate(params.get("end"));
  if (!start || !end) return { start: "", end: "" };
  return start <= end ? { start, end } : { start: end, end: start };
};

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
      extra: numOrEmpty(record.extra_earn),
      extraNote: record.note ?? "",
      billing:
        record.billing == null || record.billing === ""
          ? ""
          : String(record.billing),
      billingName: record.billing_name ?? null,
      payment: numOrEmpty(record.fooding_pay),
      advance: numOrEmpty(record.advance_pay),
      return: numOrEmpty(record.return_amount),
      settlement: 0,
      pending_activities: record.pending_activities,
    });
  }

  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

const hasPresent = (row) => row.present !== "" && row.present != null;
const hasExtra = (row) => row.extra !== "" && row.extra != null;
const amountPositive = (value) => {
  if (value === "" || value == null) return false;
  return Number(value) > 0;
};

const hasMeaningfulDayValue = (row) =>
  (hasPresent(row) && Number(row.present) > 0) ||
  amountPositive(row.extra) ||
  amountPositive(row.payment) ||
  amountPositive(row.advance) ||
  amountPositive(row.return);

const MEANINGFUL_DAY_VALUE_MESSAGE =
  "হাজিরা, বাড়তি কাজ, খোরাকি, অ্যাডভান্স বা রিটার্নের অন্তত একটি মান ০-এর বেশি দিন।";

const presentEarnings = (row) => {
  if (!hasPresent(row) || Number(row.present) === 0) return 0;
  return Number(row.present) * num(row.salary);
};

const rowEarnings = (row, selected = ["from_present", "from_extra"]) => {
  let total = 0;
  if (selected.includes("from_present")) total += presentEarnings(row);
  if (selected.includes("from_extra")) {
    total += amountPositive(row.extra) ? Number(row.extra) : 0;
  }
  return total;
};

const SummaryRow = ({ label, children, className }) => (
  <div className="flex justify-between gap-3">
    <span className="text-base-content/70">{label}</span>
    <span className={`tabular-nums ${className ?? ""}`}>{children}</span>
  </div>
);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const queryClient = useQueryClient();
  const { can, profile } = usePermissions();
  const isRunningRoute = sessionId === "running";
  const isLatestRoute = sessionId === "latest";
  const canView = can(PERMS.viewLabourSession);
  const { getSiteName } = useSitesLookup({ enabled: canView });
  const canCloseSession = can(PERMS.addLabourSession);
  const canDeleteSession = can(PERMS.deleteLabourSession);
  const canChangeDailyRecord = can(PERMS.changeDailyRecord);
  const canDeleteDailyRecord = can(PERMS.deleteDailyRecord);
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

  const [billingFilter, setBillingFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [dateStart, setDateStart] = useState(
    () => readDateRangeFromSearch(searchParams).start,
  );
  const [dateEnd, setDateEnd] = useState(
    () => readDateRangeFromSearch(searchParams).end,
  );
  const [bulkSalary, setBulkSalary] = useState("");
  const [bulkSalaryBusy, setBulkSalaryBusy] = useState(false);
  const [recordModal, setRecordModal] = useState(null);
  const [recordModalView, setRecordModalView] = useState(MODAL_VIEWS.detail);
  const [modalEditing, setModalEditing] = useState(false);
  const [modalSnapshot, setModalSnapshot] = useState(null);
  const [modalApiError, setModalApiError] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [reviewing, setReviewing] = useState(false);
  const [showSalary, setShowSalary] = useState(() => readSessionShowSalary());
  const [hajiraFilterOpen, setHajiraFilterOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeApiError, setCloseApiError] = useState(null);
  const [settlement, setSettlement] = useState("");

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
    const withActivity = canViewActivityLog
      ? applyPendingActivitiesToHajiraRows(
          applyActivitiesToSessionRows(base, activitiesQuery.data ?? []),
        )
      : base;
    const settleAmt = num(session?.settlement);
    const settleDates = [
      toIsoDate(session?.date),
      toIsoDate(session?.created_date),
      toIsoDate(session?.end_date),
    ].filter(Boolean);
    const withSettle = withActivity.map((row) => ({ ...row, settlement: 0 }));
    if (settleAmt) {
      settleSearch: for (const settleDate of settleDates) {
        for (let i = withSettle.length - 1; i >= 0; i -= 1) {
          if (toIsoDate(withSettle[i].date) === settleDate) {
            withSettle[i] = { ...withSettle[i], settlement: settleAmt };
            break settleSearch;
          }
        }
      }
    }
    return withSettle;
  }, [
    dailyRecordsQuery.data,
    activitiesQuery.data,
    canViewActivityLog,
    session?.date,
    session?.created_date,
    session?.end_date,
    session?.settlement,
  ]);

  const billingSiteIds = useMemo(() => {
    const ids = rows.map((row) => row.siteId).filter((id) => id != null && id !== "");
    if (recordModal?.siteId != null && recordModal.siteId !== "") {
      ids.push(recordModal.siteId);
    }
    return ids;
  }, [rows, recordModal?.siteId]);

  const { getBillingName, getActiveCategories } = useBillingLookups(
    billingSiteIds,
    { enabled: canView },
  );

  const billingFullLabel = (id, siteId) => {
    if (id == null || id === "") return NULL_BILLING_LABEL;
    if (siteId != null && siteId !== "") return getBillingName(siteId, id);
    const fromRow = rows.find((row) => String(row.billing) === String(id));
    if (fromRow?.billingName) return fromRow.billingName;
    if (fromRow?.siteId != null) return getBillingName(fromRow.siteId, id);
    return `#${id}`;
  };

  const billingFullLabelForRow = (row) => {
    if (row?.billing == null || row.billing === "") return NULL_BILLING_LABEL;
    if (row.billingName) return row.billingName;
    return getBillingName(row.siteId, row.billing);
  };

  const dateFilteredRows = useMemo(() => {
    const start = toIsoDate(dateStart);
    const end = toIsoDate(dateEnd);
    if (!start || !end) return rows;
    return rows.filter((row) => {
      const d = toIsoDate(row.date);
      return Boolean(d && d >= start && d <= end);
    });
  }, [rows, dateStart, dateEnd]);

  const uniqueSites = useMemo(() => {
    const seen = new Map();
    for (const row of rows) {
      if (row.siteId == null || row.siteId === "") continue;
      const value = String(row.siteId);
      if (seen.has(value)) continue;
      seen.set(value, { value, label: getSiteName(row.siteId) });
    }
    return [...seen.values()];
  }, [rows, getSiteName]);

  const sessionDateBounds = useMemo(() => {
    const dates = [];
    for (const row of rows) {
      const d = toIsoDate(row.date);
      if (d) dates.push(d);
    }
    if (!dates.length) return null;
    dates.sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [rows]);

  const datePresets = useMemo(() => {
    const byMonth = new Map();
    for (const row of rows) {
      const iso = toIsoDate(row.date);
      if (!iso) continue;
      const key = iso.slice(0, 7);
      const rec = byMonth.get(key);
      if (!rec) byMonth.set(key, { min: iso, max: iso });
      else {
        if (iso < rec.min) rec.min = iso;
        if (iso > rec.max) rec.max = iso;
      }
    }
    const keys = [...byMonth.keys()].sort();
    const multiYear = new Set(keys.map((key) => key.slice(0, 4))).size > 1;
    const months = keys.map((key) => {
      const { min, max } = byMonth.get(key);
      const d = parseIsoDate(min);
      const label = d
        ? new Intl.DateTimeFormat("bn-BD", {
            month: "long",
            ...(multiYear ? { year: "numeric" } : {}),
          }).format(d)
        : key;
      return {
        id: key,
        label,
        start: min,
        end: min === max ? null : max,
      };
    });
    return [
      { id: "all", label: "সব হাজিরা", start: ALL_DATES, end: null },
      ...months,
    ];
  }, [rows]);

  const selectedSiteId = siteFilter;
  const billingEnabled =
    SHOW_BILLING && selectedSiteId !== "all" && uniqueSites.length > 0;

  const billingFilterOptions = useMemo(() => {
    const options = [{ value: "all", label: "সব বিলিং" }];
    if (!billingEnabled) return options;
    options.push({ value: "none", label: NULL_BILLING_LABEL });
    const seen = new Set();
    for (const row of dateFilteredRows) {
      if (String(row.siteId ?? "") !== String(selectedSiteId)) continue;
      if (row.billing == null || row.billing === "") continue;
      const value = String(row.billing);
      if (seen.has(value)) continue;
      seen.add(value);
      options.push({
        value,
        label: row.billingName || getBillingName(row.siteId, value),
      });
    }
    return options;
  }, [billingEnabled, dateFilteredRows, selectedSiteId, getBillingName]);

  useEffect(() => {
    if (
      uniqueSites.length > 0 &&
      siteFilter !== "all" &&
      !uniqueSites.some((site) => site.value === siteFilter)
    ) {
      setSiteFilter("all");
      setBillingFilter("all");
    }
  }, [uniqueSites, siteFilter]);

  const visibleRows = useMemo(() => {
    return dateFilteredRows.filter((row) => {
      if (
        selectedSiteId !== "all" &&
        String(row.siteId ?? "") !== String(selectedSiteId)
      ) {
        return false;
      }
      if (!billingEnabled || billingFilter === "all") return true;
      if (billingFilter === "none") {
        return row.billing == null || row.billing === "";
      }
      return String(row.billing ?? "") === String(billingFilter);
    });
  }, [
    dateFilteredRows,
    selectedSiteId,
    billingEnabled,
    billingFilter,
  ]);

  const activityIdsForRow = (row) =>
    (row?.activityLogs ?? row?.pending_activities ?? [])
      .map((log) => Number(log.id))
      .filter((id) => Number.isFinite(id));

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
    try {
      await reviewActivities(ids);
      exitSelectMode();
      await invalidateRecordQueries();
      await queryClient.invalidateQueries({ queryKey: ["activities"] });
      toastSuccess("অডিট সম্পন্ন হয়েছে");
    } catch (err) {
      const parsed = parseApiError(err);
      const message = formatBulkReviewError(parsed);
      toastApiError({
        message,
        errors: [{ code: null, detail: message, attr: null }],
      });
    } finally {
      setReviewing(false);
    }
  };

  const totals = useMemo(() => {
    const result = visibleRows.reduce(
      (acc, row) => {
        acc.present += hasPresent(row) ? num(row.present) : 0;
        acc.salary += num(row.salary);
        acc.extra += hasExtra(row) ? num(row.extra) : 0;
        acc.earnings += rowEarnings(row);
        acc.payment += num(row.payment);
        acc.advance += num(row.advance);
        acc.return += num(row.return);
        acc.settlement += num(row.settlement);
        return acc;
      },
      {
        present: 0,
        salary: 0,
        extra: 0,
        earnings: 0,
        payment: 0,
        advance: 0,
        return: 0,
        settlement: 0,
      },
    );
    if (!result.settlement) {
      result.settlement = num(session?.settlement);
    }
    return result;
  }, [visibleRows, session?.settlement]);

  const dateFilterActive = Boolean(toIsoDate(dateStart) && toIsoDate(dateEnd));

  // ── Session close / delete ──────────────────────────────────────────
  const isRunning = isRunningRoute || Boolean(session?.is_running);

  const latestSessionQuery = useQuery({
    queryKey: ["labours", labourId, "latest-session"],
    // Latest *created* session, excluding the running (open) one.
    queryFn: async () => {
      const all = await fetchAllPages(({ page, page_size }) =>
        fetchLabourSessions(labourId, { page, page_size }),
      );
      const sealed = all.filter((s) => s?.id != null && !s.is_running);
      if (!sealed.length) return null;
      return sealed.reduce((latest, s) => {
        const a = Number(s.id);
        const b = Number(latest.id);
        if (Number.isFinite(a) && Number.isFinite(b)) return a > b ? s : latest;
        return String(s.id) > String(latest.id) ? s : latest;
      });
    },
    enabled: Boolean(canView && labourId),
  });
  const latestSession = latestSessionQuery.data ?? null;
  const lastSessionEnd = toIsoDate(latestSession?.end_date);

  // Partial close: the date filter's end date is the session end_date.
  // No active filter → close everything up to the last record.
  const lastRecordDate = sessionDateBounds?.max ?? "";
  const closeEndDate = dateFilterActive ? toIsoDate(dateEnd) : lastRecordDate;
  const closeIsPartial = Boolean(
    closeEndDate && lastRecordDate && closeEndDate < lastRecordDate,
  );

  let closeBlockReason = "";
  if (!latestSessionQuery.isSuccess) {
    closeBlockReason = "loading";
  } else if (!lastRecordDate) {
    closeBlockReason = "সিল করার মতো কোনো রেকর্ড নেই।";
  } else if (
    dateFilterActive &&
    toIsoDate(dateStart) > (sessionDateBounds?.min ?? "")
  ) {
    closeBlockReason =
      "শুরুর তারিখ ফিল্টার থাকলে হিসাব বন্ধ করা যাবে না। শুধু শেষ তারিখ দিয়ে ভাগ করা যায়।";
  } else if (lastSessionEnd && closeEndDate <= lastSessionEnd) {
    closeBlockReason = `শেষ হিসাবের তারিখ (${formatDate(lastSessionEnd)}) এর পরের তারিখ নির্বাচন করুন।`;
  } else if (closeEndDate > lastRecordDate) {
    closeBlockReason = `শেষ রেকর্ডের তারিখ (${formatDate(lastRecordDate)}) এর মধ্যে তারিখ নির্বাচন করুন।`;
  }
  const canOpenCloseModal = Boolean(
    isRunning && canCloseSession && !closeBlockReason,
  );

  const runningStartDate =
    session?.start_date || sessionDateBounds?.min || "";
  const runningEndDate = lastRecordDate;

  const closePreviewQuery = useQuery({
    queryKey: ["labours", labourId, "close-preview", closeEndDate],
    queryFn: async () => {
      const { data } = await fetchLabourRunningSession(labourId, {
        end_date: closeEndDate,
      });
      return data || null;
    },
    enabled: Boolean(closeModalOpen && canOpenCloseModal && closeIsPartial),
  });
  // Whole close → the running session itself is the preview.
  const closeSummary = closeIsPartial ? closePreviewQuery.data : session;
  const closePreviewLoading = closeIsPartial && closePreviewQuery.isFetching;
  const settlementValid =
    settlement === "" ||
    (settlement !== "-" && Number.isFinite(Number(settlement)));
  const settlementAmount = settlement === "" ? 0 : num(settlement);
  const closeRemainingPayable =
    num(closeSummary?.cumulative_payable) - settlementAmount;

  const closeSessionMutation = useMutation({
    mutationFn: () =>
      closeLabourSession(labourId, {
        end_date: closeIsPartial ? closeEndDate : undefined,
        settlement: settlementAmount,
      }),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: () => deleteLabourSession(labourId, session.id),
  });

  const closeCloseModal = () => {
    document.getElementById(CLOSE_MODAL_ID)?.close();
  };

  const openCloseModal = () => {
    if (!canOpenCloseModal) return;
    setCloseApiError(null);
    setSettlement("");
    setCloseModalOpen(true);
    document.getElementById(CLOSE_MODAL_ID)?.showModal();
  };

  const invalidateAfterSessionChange = () => {
    // Detail page is not mounted yet; mark stale so it refetches on mount.
    void queryClient.invalidateQueries({
      queryKey: ["labours", labourId],
      refetchType: "none",
    });
    void queryClient.invalidateQueries({ queryKey: ["activities"] });
  };

  const onConfirmClose = async () => {
    if (!canOpenCloseModal || !closeSummary || !settlementValid) return;
    setCloseApiError(null);
    try {
      await closeSessionMutation.mutateAsync();
      closeCloseModal();
      toastSuccess("হিসাব বন্ধ হয়েছে");
      navigate(paths.labourDetail(labourId), { replace: true });
      invalidateAfterSessionChange();
    } catch (error) {
      setCloseApiError(parseApiError(error));
    }
  };

  const isLatestSession = Boolean(
    !isRunning &&
      session?.id != null &&
      latestSession?.id != null &&
      String(latestSession.id) === String(session.id),
  );
  const canDeleteThisSession = Boolean(
    canDeleteSession && isLatestSession && !session?.is_modified,
  );

  const onDeleteSession = async () => {
    if (!canDeleteThisSession) return;
    const confirmed = await confirmAction({
      title: "হিসাব মুছে ফেলবেন?",
      text: "এই কাজটি ফিরিয়ে আনা যাবে না।",
      confirmText: "ডিলিট করুন",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteSessionMutation.mutateAsync();
      toastSuccess("হিসাব ডিলিট হয়েছে");
      navigate(paths.labourDetail(labourId), { replace: true });
      invalidateAfterSessionChange();
    } catch (error) {
      toastApiError(parseApiError(error));
    }
  };

  const onDateChange = ({ start, end }) => {
    if (isAllDates(start) || !start) {
      setDateStart("");
      setDateEnd("");
      return;
    }
    setDateStart(start);
    setDateEnd(end || start);
  };

  const applyBulkSalary = async () => {
    const salary = numOrEmpty(bulkSalary);
    if (salary === "" || !canChangeDailyRecord || bulkSalaryBusy) return;
    const wage = Number(salary);
    if (!Number.isFinite(wage) || wage < 0) return;

    const targets = visibleRows.filter(
      (row) => row.recordId && !row.sealed && isSiteAllowed(row.siteId),
    );
    if (!targets.length) {
      toastInfo("আপডেট করার মতো কোনো রেকর্ড নেই।");
      return;
    }

    setBulkSalaryBusy(true);
    try {
      const results = await Promise.allSettled(
        targets.map((row) =>
          updateLabourDailyRecord(labourId, row.recordId, { wage }),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected");
      await invalidateRecordQueries();
      if (failed.length === 0) {
        toastSuccess("বেতন সেট হয়েছে");
        setBulkSalary("");
        setHajiraFilterOpen(false);
      } else if (failed.length < results.length) {
        toastInfo(
          `${formatBnNumber(failed.length)}টি রেকর্ড আপডেট হয়নি।`,
        );
      } else {
        toastApiError(parseApiError(failed[0].reason));
      }
    } catch (error) {
      toastApiError(parseApiError(error));
    } finally {
      setBulkSalaryBusy(false);
    }
  };

  useEffect(() => {
    const start = toIsoDate(dateStart);
    const end = toIsoDate(dateEnd);
    const next = new URLSearchParams(searchParams);
    if (start && end) {
      next.set("start", start <= end ? start : end);
      next.set("end", start <= end ? end : start);
    } else {
      next.delete("start");
      next.delete("end");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync outward from state
  }, [dateStart, dateEnd]);

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

  const billingOptions = useMemo(() => {
    const opts = [...(getActiveCategories(recordModal?.siteId) ?? [])];
    const cur = recordModal?.billing;
    if (
      cur !== "" &&
      cur != null &&
      !opts.some((b) => String(b.id) === String(cur))
    ) {
      opts.unshift({
        id: cur,
        name:
          recordModal?.billingName ||
          billingFullLabel(cur, recordModal?.siteId),
      });
    }
    return opts;
  }, [
    getActiveCategories,
    recordModal?.siteId,
    recordModal?.billing,
    recordModal?.billingName,
    rows,
  ]);

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
        row.present === "" || row.present == null ? "0" : String(row.present),
      salary:
        row.present === "" ||
        row.present == null ||
        Number(row.present) === 0
          ? ""
          : row.salary,
      extra: row.extra === "" || row.extra == null ? "" : row.extra,
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
    const present =
      recordModal.present === "" || recordModal.present == null
        ? 0
        : Number(recordModal.present);
    const payloadRow = {
      labourId,
      present,
      salary: present === 0 ? "" : recordModal.salary,
      extra: recordModal.extra,
      extraNote: recordModal.note,
      billing: recordModal.billing,
      payment: recordModal.payment,
      advance: recordModal.advance,
      return: recordModal.return,
      date: toIsoDate(recordModal.date),
    };
    if (!hasMeaningfulDayValue(payloadRow)) return;
    setModalApiError(null);
    try {
      await updateMutation.mutateAsync({
        recordId: recordModal.recordId,
        payload: toDailyRecordPatchPayload(payloadRow),
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
    const labour = labourQuery.data;
    const labourName = labour?.name;
    setHeaderMenu?.(
      labourName ? (
        <div className="flex items-center gap-2 min-w-0 px-1 max-w-full">
          <PersonAvatar
            photo={labour.photo}
            name={labourName}
            size="xs"
          />
          <Link
            to={paths.labourDetail(labour.id ?? labourId)}
            className="text-sm font-medium text-base-content/80 truncate underline underline-offset-2"
          >
            {labourName}
          </Link>
        </div>
      ) : null,
    );
    return () => setHeaderMenu?.(null);
  }, [labourQuery.data, labourId, setHeaderMenu]);

  if (!canView) {
    return (
      <div className="text-sm text-error py-8 text-center px-3">
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
      <div className="flex-1 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center px-3">
        হিসাব পাওয়া যায়নি।
      </div>
    );
  }

  if (session.is_modified) {
    return (
      <div className="alert alert-warning text-sm mx-3 mt-3">
        হিসাবটি পরিবর্তিত হয়েছে। রেকর্ড দেখা বন্ধ।
      </div>
    );
  }

  const recordsError = dailyRecordsQuery.error || activitiesQuery.error;
  const remainTotal = remainingOf(totals);
  // সর্বমোট পাওনা = বর্তমান পাওনা (table totals, settlement included) + আগের পাওনা.
  const currentPayable = remainTotal + num(session.previous_payable);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 py-3">
      {recordsError ? (
        <ApiErrorAlert error={parseApiError(recordsError)} />
      ) : null}

      <div className="flex items-stretch justify-between gap-2 shrink-0 px-3">
        <DateSelector
          startDate={dateFilterActive ? dateStart : ALL_DATES}
          endDate={dateFilterActive ? dateEnd : null}
          onChange={onDateChange}
          presets={datePresets}
          allDatesLabel="সব হাজিরা"
          resetPresetId="all"
          minDate={sessionDateBounds?.min}
          maxDate={sessionDateBounds?.max}
        />
        <SiteSelector
          sites={[
            { id: "all", name: "সব সাইট" },
            ...uniqueSites.map((site) => ({
              id: site.value,
              name: site.label,
            })),
          ]}
          value={selectedSiteId}
          onChange={(id) => {
            setSiteFilter(id);
            setBillingFilter("all");
          }}
        />
      </div>

      {SHOW_BILLING ? (
        <div className="flex items-center justify-end gap-2 shrink-0 px-3">
          <select
            className="select select-bordered select-sm min-w-36"
            value={billingEnabled ? billingFilter : "all"}
            disabled={!billingEnabled}
            onChange={(e) => setBillingFilter(e.target.value)}
            aria-label="বিলিং ফিল্টার"
          >
            {billingFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto pb-24">
        <table className="table table-xs table-auto w-full bg-transparent text-xs border-separate border-spacing-0 border-t border-l border-base-content/35 [&_th]:!px-1 [&_th]:!py-2 sm:[&_th]:!py-3 [&_th]:bg-base-300 [&_td]:!px-0.5 [&_td]:!py-px [&_tbody_tr]:bg-transparent [&_tbody_td]:bg-transparent [&_tbody_tr:hover]:bg-transparent [&_tfoot_tr]:bg-transparent [&_tfoot_td]:bg-transparent">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className={PAIR_COL} />
            <col className={PAIR_COL} />
            <col className={PAIR_COL} />
          </colgroup>
          <thead className={`sticky top-0 z-10 ${HEAD_BG}`}>
            <tr>
              <th className={`w-10 align-middle text-center ${CELL} ${HEAD_BG}`}>
                <span className="inline-flex w-full items-center justify-center">
                  {selectMode && canChangeActivityLog ? (
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
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
                </span>
              </th>
              <th className={`min-w-0 pl-1 align-middle ${CELL} ${HEAD_BG}`}>
                তারিখ
              </th>
              <th
                colSpan={2}
                className={`text-center align-middle font-medium ${CELL} ${HEAD_BG}`}
              >
                <HeaderFilterPopover
                  open={hajiraFilterOpen}
                  onOpenChange={setHajiraFilterOpen}
                  title="হাজিরা"
                >
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={showSalary}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setShowSalary(next);
                        writeSessionShowSalary(next);
                      }}
                    />
                    <span>বেতন দেখান</span>
                  </label>
                  {canChangeDailyRecord ? (
                    <div className="flex flex-col gap-2 mt-3">
                      <label className="form-control w-full">
                        <span className="label-text text-sm">বেতন</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          className="input input-bordered input-sm w-full tabular-nums"
                          value={bulkSalary}
                          disabled={bulkSalaryBusy}
                          onChange={(e) =>
                            setBulkSalary(numOrEmpty(e.target.value))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-full"
                        onClick={() => void applyBulkSalary()}
                        disabled={
                          bulkSalaryBusy ||
                          bulkSalary === "" ||
                          bulkSalary == null
                        }
                      >
                        {bulkSalaryBusy ? (
                          <span className="loading loading-spinner loading-sm" />
                        ) : null}
                        আপডেট করুন
                      </button>
                    </div>
                  ) : null}
                </HeaderFilterPopover>
              </th>
              <th
                className={`text-center align-middle font-medium ${CELL} ${SORBOMOT_BG}`}
              >
                সর্বমোট
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className={`text-center text-sm text-base-content/60 !py-10 ${CELL}`}
                >
                  কোনো রেকর্ড পাওয়া যায়নি।
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const fill = cellFill(row, index);
                const { paid: settlePaid, back: settleBack } = splitSettlement(
                  row.settlement,
                );
                const hasSession = settlePaid !== 0 || settleBack !== 0;
                const earn = rowEarnings(row);
                const rowKey = `${row.date}-${row.siteId ?? ""}-${row.recordId ?? index}`;
                const rowActivityIds = activityIdsForRow(row);
                const selectable = rowActivityIds.length > 0;
                const rowSelected =
                  selectable &&
                  rowActivityIds.every((id) => selectedIds.has(id));
                const rowTitle = hasSession
                  ? settlePaid
                    ? "হিসাবের সময় দেওয়া হয়েছে"
                    : "হিসাবের সময় ফেরত নেওয়া হয়েছে"
                  : undefined;

                return (
                  <Fragment key={rowKey}>
                    <tr className="bg-transparent">
                      <td
                        rowSpan={PAIR_ROWS}
                        className={`align-middle text-center tabular-nums text-base-content/60 w-10 ${CELL} ${fill}`}
                      >
                        <span className="inline-flex w-full items-center justify-center">
                          {selectMode && canChangeActivityLog ? (
                            <input
                              type="checkbox"
                              className="checkbox checkbox-xs"
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
                        </span>
                      </td>
                      <td
                        rowSpan={PAIR_ROWS}
                        className={`align-middle whitespace-nowrap pl-1 ${CELL} ${fill}`}
                      >
                        {formatDate(row.date)}
                      </td>
                      <td
                        className={`${VALUE_CELL} ${CELL_TOP_INNER} ${fill} ${sessionPairClass(hasSession, "top", "left")} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                      >
                        <PresentLine
                          present={row.present}
                          salary={row.salary}
                          showSalary={showSalary}
                        />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${CELL_TOP} ${fill} ${sessionPairClass(hasSession, "top", "right")} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                      >
                        <Amount value={row.extra} tone="text-success" />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${CELL_TOP} ${SORBOMOT_BG}`}
                      >
                        <Amount value={earn} tone="text-success" />
                      </td>
                    </tr>
                    <tr className="bg-transparent">
                      <td
                        className={`${VALUE_CELL} ${ROW2_LEFT} ${fill} ${sessionPairClass(hasSession, "mid", "left")} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                      >
                        <Amount value={row.payment} tone="text-error" />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${ROW2_RIGHT} ${fill} ${sessionPairClass(hasSession, "mid", "right")} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                        title={settlePaid ? rowTitle : undefined}
                      >
                        <JoinedAmounts
                          tone="text-error"
                          parts={[
                            { value: row.advance },
                            { value: settlePaid },
                          ]}
                        />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${ROW2_RIGHT} ${SORBOMOT_BG}`}
                      >
                        <Amount
                          value={
                            num(row.payment) + num(row.advance) + settlePaid
                          }
                          tone="text-error"
                        />
                      </td>
                    </tr>
                    <tr className="bg-transparent">
                      <td
                        className={`${VALUE_CELL} ${CELL_SUB_INNER} ${fill} ${sessionPairClass(hasSession, "bot", "left")} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                      >
                        <Amount value={row.return} tone={RETURN_TONE} />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${CELL_SUB} ${fill} ${sessionPairClass(hasSession, "bot", "right")} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                        title={settleBack ? rowTitle : undefined}
                      >
                        <Amount value={settleBack} tone={RETURN_TONE} />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}
                      >
                        <Amount
                          value={num(row.return) + settleBack}
                          tone={RETURN_TONE}
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
          {visibleRows.length > 0 ? (
            <tfoot>
              <tr className="font-medium bg-transparent">
                <td
                  colSpan={2}
                  className={`align-middle text-right whitespace-nowrap pr-1 ${CELL} ${FOOT_BG}`}
                >
                  মোট উপার্জন
                </td>
                <td
                  className={`${VALUE_CELL} ${CELL_TOP_INNER} ${FOOT_BG} !align-baseline`}
                >
                  <Amount value={totals.present} />
                </td>
                <td
                  className={`${VALUE_CELL} ${CELL_TOP} ${FOOT_BG} !align-baseline`}
                >
                  <Amount value={totals.extra} tone="text-success" />
                </td>
                <td
                  className={`${VALUE_CELL} ${CELL_TOP} ${SORBOMOT_BG} !align-baseline`}
                >
                  <Amount value={totals.earnings} tone="text-success" />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                <td
                  colSpan={2}
                  className={`align-middle text-right whitespace-nowrap pr-1 ${CELL} ${FOOT_BG}`}
                >
                  মোট দেওয়া
                </td>
                <td className={`${VALUE_CELL} ${ROW2_LEFT} ${FOOT_BG}`}>
                  <Amount value={totals.payment} tone="text-error" />
                </td>
                <td className={`${VALUE_CELL} ${ROW2_RIGHT} ${FOOT_BG}`}>
                  <JoinedAmounts
                    tone="text-error"
                    parts={[
                      { value: totals.advance },
                      { value: splitSettlement(totals.settlement).paid },
                    ]}
                  />
                </td>
                <td className={`${VALUE_CELL} ${ROW2_RIGHT} ${SORBOMOT_BG}`}>
                  <Amount
                    value={
                      num(totals.payment) +
                      num(totals.advance) +
                      splitSettlement(totals.settlement).paid
                    }
                    tone="text-error"
                  />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                <td
                  colSpan={2}
                  className={`align-middle text-right whitespace-nowrap pr-1 ${CELL} ${FOOT_BG}`}
                >
                  মোট ফেরত
                </td>
                <td className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_BG}`}>
                  <Amount value={totals.return} tone={RETURN_TONE} />
                </td>
                <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_BG}`}>
                  <Amount
                    value={splitSettlement(totals.settlement).back}
                    tone={RETURN_TONE}
                  />
                </td>
                <td className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}>
                  <Amount
                    value={
                      num(totals.return) +
                      splitSettlement(totals.settlement).back
                    }
                    tone={RETURN_TONE}
                  />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                <td
                  colSpan={2}
                  className={`align-middle text-right whitespace-nowrap pr-1 ${CELL} ${SORBOMOT_BG}`}
                >
                  বর্তমান পাওনা
                </td>
                <td
                  colSpan={3}
                  className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}
                >
                  <Amount
                    value={remainTotal}
                    tone={remainTone(remainTotal)}
                  />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                <td
                  colSpan={2}
                  className={`align-middle whitespace-nowrap text-right pr-1 ${CELL} ${SORBOMOT_BG}`}
                >
                  আগের পাওনা
                </td>
                <td
                  colSpan={3}
                  className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}
                >
                  <Amount
                    value={num(session.previous_payable)}
                    tone={signedTone(num(session.previous_payable))}
                  />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                <td
                  colSpan={2}
                  className={`align-middle whitespace-nowrap text-right pr-1 ${signedTone(currentPayable)} ${CELL} ${SORBOMOT_BG}`}
                >
                  সর্বমোট পাওনা
                </td>
                <td
                  colSpan={3}
                  className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}
                >
                  <Amount
                    value={currentPayable}
                    tone={signedTone(currentPayable)}
                  />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>

        {(isRunning && canCloseSession) ||
        (!isRunning && canDeleteSession) ? (
          <div className="px-3 pt-4 space-y-2">
            {isRunning ? (
              <>
                {closeBlockReason && closeBlockReason !== "loading" ? (
                  <p className="text-xs text-warning text-center">
                    {closeBlockReason}
                  </p>
                ) : closeIsPartial ? (
                  <p className="text-xs text-base-content/60 text-center">
                    {formatDate(closeEndDate)} পর্যন্ত বন্ধ হবে। বাকি
                    হিসাব চলমান থাকবে।
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={
                    !canOpenCloseModal || closeSessionMutation.isPending
                  }
                  onClick={openCloseModal}
                >
                  হিসাব বন্ধ করুন
                </button>
              </>
            ) : (
              <>
                {!canDeleteThisSession && latestSessionQuery.isSuccess ? (
                  <p className="text-xs text-base-content/60 text-center">
                    শুধু সর্বশেষ হিসাবটি মুছে ফেলা যায়।
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-error w-full"
                  disabled={
                    !canDeleteThisSession || deleteSessionMutation.isPending
                  }
                  onClick={() => void onDeleteSession()}
                >
                  {deleteSessionMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  ডিলিট করুন
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <HajiraActionBars
        hasPendingCreates={false}
        onCancel={exitSelectMode}
        saving={false}
        onSave={() => {}}
        rows={visibleRows}
        selectMode={selectMode}
        canChangeActivityLog={canChangeActivityLog}
        reviewing={reviewing}
        exitSelectMode={exitSelectMode}
        selectedIds={selectedIds}
        onAcceptChanges={onAcceptChanges}
      />

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
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col overflow-hidden!">
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
                {modalApiError ? (
                  <ApiErrorAlert error={modalApiError} />
                ) : null}
                <div className="text-sm text-base-content/60 space-y-2">
                  {modalEditing ? (
                    <label className="form-control w-full">
                      <span className="label-text mb-1 text-base-content">
                        তারিখ
                      </span>
                      <input
                        type="date"
                        className="input input-bordered input-sm w-full"
                        value={toIsoDate(recordModal.date)}
                        max={todayIso()}
                        onChange={(e) =>
                          setRecordModal((m) => ({
                            ...m,
                            date: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : (
                    <div className="form-control w-full">
                      <span className="label-text mb-1">তারিখ</span>
                      <div className="min-h-8 flex items-center px-1 text-sm text-base-content font-medium">
                        {formatDate(recordModal.date)}
                      </div>
                    </div>
                  )}
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
                          onChange={(e) => {
                            const present = e.target.value;
                            setRecordModal((m) => ({
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
                          value={recordModal.salary}
                          disabled={Number(recordModal.present) === 0}
                          onChange={(e) =>
                            setRecordModal((m) => ({
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
                          value={recordModal.payment}
                          onChange={(e) =>
                            setRecordModal((m) => ({
                              ...m,
                              payment: numOrEmpty(e.target.value),
                            }))
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
                            onChange={(e) =>
                              setRecordModal((m) => ({
                                ...m,
                                extra: numOrEmpty(e.target.value),
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
                          disabled={!hasMeaningfulDayValue(recordModal)}
                          onChange={(e) =>
                            setRecordModal((m) => ({
                              ...m,
                              note: e.target.value,
                            }))
                          }
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
                    ) : null}
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
                        disabled={
                          updateMutation.isPending ||
                          !hasMeaningfulDayValue(recordModal)
                        }
                        title={
                          hasMeaningfulDayValue(recordModal)
                            ? undefined
                            : MEANINGFUL_DAY_VALUE_MESSAGE
                        }
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
                          {displayValue(recordModal.salary)}
                        </div>
                      </div>
                      <div className="form-control w-full min-w-0">
                        <span className="label-text text-sm">খোরাকি</span>
                        <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                          {displayValue(recordModal.payment)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-dashed border-base-300 pt-3 opacity-50 [&_.label-text]:text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="form-control w-full min-w-0">
                          <span className="label-text text-sm">বাড়তি কাজ</span>
                          <div className="min-h-8 flex items-center px-1 text-sm tabular-nums">
                            {displayValue(recordModal.extra)}
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
                    </div>
                    {SHOW_BILLING ? (
                    <div className="form-control w-full">
                      <span className="label-text text-sm">বিলিং</span>
                      <div className="min-h-8 flex items-center px-1 text-sm">
                        {billingFullLabelForRow(recordModal)}
                      </div>
                    </div>
                    ) : null}
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
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>

      <dialog
        id={CLOSE_MODAL_ID}
        className="modal"
        onClose={() => {
          setCloseModalOpen(false);
          setCloseApiError(null);
        }}
      >
        <div className="modal-box max-w-sm p-4 max-h-[min(36rem,90vh)] flex flex-col overflow-hidden!">
          <form method="dialog" className="flex justify-end shrink-0 -mt-1 -mr-1 mb-1">
            <button
              className="btn btn-xs btn-circle btn-ghost"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <ApiErrorAlert error={closeApiError} />
          {closeIsPartial && closePreviewQuery.isError ? (
            <ApiErrorAlert error={parseApiError(closePreviewQuery.error)} />
          ) : null}

          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 text-sm">
            {closePreviewLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-sm text-primary" />
              </div>
            ) : closeSummary ? (
              <section className="space-y-1">
                <SummaryRow
                  label="বর্তমান পাওনা"
                  className={signedTone(num(closeSummary.payable))}
                >
                  {formatBnNumber(closeSummary.payable ?? 0)}
                </SummaryRow>
                <SummaryRow
                  label="আগের পাওনা"
                  className={signedTone(num(closeSummary.previous_payable))}
                >
                  {formatBnSigned(closeSummary.previous_payable ?? 0)}
                </SummaryRow>
                <div className="border-t border-base-300 pt-1">
                  <SummaryRow
                    label="সর্বমোট পাওনা"
                    className={`font-semibold ${signedTone(num(closeSummary.cumulative_payable))}`}
                  >
                    {formatBnNumber(closeSummary.cumulative_payable ?? 0)}
                  </SummaryRow>
                </div>
                <label className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-base-content/70">
                    হিসাবের সময় দেওয়া
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={1}
                    className={`input input-bordered input-sm w-28 text-right tabular-nums ${
                      settlementValid ? "" : "input-error"
                    }`}
                    placeholder="০"
                    value={settlement}
                    disabled={closeSessionMutation.isPending}
                    onChange={(e) => setSettlement(e.target.value)}
                  />
                </label>
                {settlementValid ? (
                  <div className="border-t border-base-300 pt-1">
                    <SummaryRow
                      label="হিসাব বন্ধের পর পাওনা থাকবে"
                      className={`font-semibold whitespace-nowrap ${signedTone(closeRemainingPayable)}`}
                    >
                      {formatBnNumber(closeRemainingPayable)}
                    </SummaryRow>
                  </div>
                ) : null}
              </section>
            ) : closeIsPartial && !closePreviewQuery.isError ? (
              <div className="text-sm text-base-content/60 text-center py-2">
                এই সময়ের মধ্যে কোনো রেকর্ড নেই।
              </div>
            ) : null}

            <p className="text-xs text-warning">
              এই শ্রমিকের চলমান হিসাবে হাজিরা আছে{" "}
              <CloseWarnDate iso={runningStartDate} /> থেকে{" "}
              <CloseWarnDate iso={runningEndDate} /> তারিখ পর্যন্ত{closeIsPartial ? (
                <>
                  {", "}এখন <CloseWarnDate iso={runningStartDate} /> থেকে{" "}
                  <CloseWarnDate iso={closeEndDate} /> তারিখ পর্যন্ত হিসাব
                  বন্ধ করা হবে, বাকি হাজিরা চলমান থাকবে।
                </>
              ) : (
                <>, এখন এই সব হাজিরার হিসাব বন্ধ করা হবে।</>
              )}{" "}
              হিসাব বন্ধ করার পর <CloseWarnDate iso={closeEndDate} /> তারিখ
              পর্যন্ত হাজিরা আর পরিবর্তন করা যাবে না।
            </p>
          </div>

          <div className="modal-action shrink-0 mt-3 pt-0">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={closeCloseModal}
              disabled={closeSessionMutation.isPending}
            >
              বাতিল
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void onConfirmClose()}
              disabled={
                closeSessionMutation.isPending ||
                closePreviewLoading ||
                !closeSummary ||
                !settlementValid ||
                !canOpenCloseModal
              }
            >
              {closeSessionMutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : null}
              বন্ধ করুন
            </button>
          </div>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>
    </div>
  );
};
