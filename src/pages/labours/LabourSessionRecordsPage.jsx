import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
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
import { useBillingLookups } from "../../hooks/useBillingLookup.js";
import { usePermissions } from "../../hooks/usePermissions.js";
import { useSitesLookup } from "../../hooks/useSites.js";
import {
  formatBnNumber,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import { confirmAction, toastApiError, toastInfo, toastSuccess } from "../../utils/feedback.js";
import { SHOW_BILLING } from "../../config/features.js";
import { PERMS, hasPermissionSuffix } from "../../utils/permissions.js";

const RECORD_MODAL_ID = "session_record_detail_modal";
const DATE_FILTER_MODAL_ID = "session_record_date_filter_modal";
const EARNINGS_FILTER_MODAL_ID = "session_record_earnings_filter_modal";
const PAYMENT_FILTER_MODAL_ID = "session_record_payment_filter_modal";
const HAJIRA_FILTER_MODAL_ID = "session_record_hajira_filter_modal";

const MODAL_VIEWS = {
  detail: "detail",
  history: "history",
};

const HAJIRA_FILTER_OPTIONS = [
  { value: "present", label: "উপস্থিতি" },
  { value: "salary", label: "বেতন" },
  { value: "extra", label: "বাড়তি কাজ" },
];

const EARNINGS_FILTER_OPTIONS = [
  { value: "from_present", label: "বেতন থেকে আয়" },
  { value: "from_extra", label: "বাড়তি কাজ থেকে আয়" },
];

const PAYMENT_FILTER_OPTIONS = [
  { value: "payment", label: "খোরাকি" },
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
    });
  }

  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

const hasPresent = (row) => row.present !== "" && row.present != null;
const hasExtra = (row) => row.extra !== "" && row.extra != null;
const hasAmount = (value) => value !== "" && value != null;
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

const attendanceCellLines = (row, selectedFields) => {
  const lines = [];
  if (selectedFields.includes("present") && hasPresent(row)) {
    lines.push({ key: "present", value: formatBnNumber(row.present) });
  }
  if (
    selectedFields.includes("salary") &&
    row.salary !== "" &&
    row.salary != null &&
    hasPresent(row) &&
    Number(row.present) !== 0
  ) {
    lines.push({ key: "salary", value: formatBnNumber(row.salary) });
  }
  if (selectedFields.includes("extra") && hasExtra(row)) {
    lines.push({ key: "extra", value: formatBnNumber(row.extra) });
  }
  return lines.length ? lines : [{ key: "empty", value: "—" }];
};

const hajiraTotalValue = (row, hajiraFields) => {
  if (hajiraFields.includes("present")) return hasPresent(row) ? num(row.present) : 0;
  if (hajiraFields.includes("salary")) return num(row.salary);
  if (hajiraFields.includes("extra")) return hasExtra(row) ? num(row.extra) : 0;
  return hasPresent(row) ? num(row.present) : 0;
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
  const [searchParams, setSearchParams] = useSearchParams();
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

  const [earningsFilter, setEarningsFilter] = useState([
    "from_present",
    "from_extra",
  ]);
  const [paymentFilter, setPaymentFilter] = useState([
    "payment",
    "advance",
    "return",
  ]);
  const [billingFilter, setBillingFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [hajiraFilter, setHajiraFilter] = useState(["present", "extra"]);
  const [dateStart, setDateStart] = useState(
    () => readDateRangeFromSearch(searchParams).start,
  );
  const [dateEnd, setDateEnd] = useState(
    () => readDateRangeFromSearch(searchParams).end,
  );
  const [draftDateStart, setDraftDateStart] = useState("");
  const [draftDateEnd, setDraftDateEnd] = useState("");
  const [bulkSalary, setBulkSalary] = useState("");
  const [bulkSalaryBusy, setBulkSalaryBusy] = useState(false);
  const [bulkFooding, setBulkFooding] = useState("");
  const [bulkFoodingBusy, setBulkFoodingBusy] = useState(false);
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
    for (const row of dateFilteredRows) {
      if (row.siteId == null || row.siteId === "") continue;
      const value = String(row.siteId);
      if (seen.has(value)) continue;
      seen.set(value, { value, label: getSiteName(row.siteId) });
    }
    return [...seen.values()];
  }, [dateFilteredRows, getSiteName]);

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

  const siteFilterOptions = useMemo(() => {
    if (uniqueSites.length === 0) {
      return [{ value: "all", label: "সব" }];
    }
    if (uniqueSites.length === 1) return uniqueSites;
    return [{ value: "all", label: "সব" }, ...uniqueSites];
  }, [uniqueSites]);

  const selectedSiteId =
    uniqueSites.length === 1 ? uniqueSites[0].value : siteFilter;
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
    if (uniqueSites.length === 1) {
      const only = uniqueSites[0].value;
      if (siteFilter !== only) setSiteFilter(only);
      return;
    }
    if (
      uniqueSites.length > 1 &&
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

  const dateFilterActive = Boolean(toIsoDate(dateStart) && toIsoDate(dateEnd));
  const dateHeaderLabel = dateFilterActive ? "তারিখ*" : "তারিখ";
  const earningsHeaderLabel =
    earningsFilter.length === EARNINGS_FILTER_OPTIONS.length ? "আয়" : "আয়*";
  const paymentHeaderLabel =
    paymentFilter.length === PAYMENT_FILTER_OPTIONS.length
      ? "লেনদেন"
      : "লেনদেন*";

  const closeDateFilterModal = () => {
    document.getElementById(DATE_FILTER_MODAL_ID)?.close();
  };

  const openDateFilter = () => {
    if (!sessionDateBounds) return;
    setDraftDateStart(dateStart || sessionDateBounds.min);
    setDraftDateEnd(dateEnd || sessionDateBounds.max);
    document.getElementById(DATE_FILTER_MODAL_ID)?.showModal();
  };

  const applyDateFilter = () => {
    const start = toIsoDate(draftDateStart);
    const end = toIsoDate(draftDateEnd);
    if (!start || !end) return;
    setDateStart(start <= end ? start : end);
    setDateEnd(start <= end ? end : start);
    closeDateFilterModal();
  };

  const resetDateFilter = () => {
    setDateStart("");
    setDateEnd("");
    setDraftDateStart(sessionDateBounds?.min || "");
    setDraftDateEnd(sessionDateBounds?.max || "");
    closeDateFilterModal();
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
        document.getElementById(HAJIRA_FILTER_MODAL_ID)?.close();
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

  const applyBulkFooding = async () => {
    const fooding = numOrEmpty(bulkFooding);
    if (fooding === "" || !canChangeDailyRecord || bulkFoodingBusy) return;
    const fooding_pay = Number(fooding);
    if (!Number.isFinite(fooding_pay) || fooding_pay < 0) return;

    const targets = visibleRows.filter(
      (row) => row.recordId && !row.sealed && isSiteAllowed(row.siteId),
    );
    if (!targets.length) {
      toastInfo("আপডেট করার মতো কোনো রেকর্ড নেই।");
      return;
    }

    setBulkFoodingBusy(true);
    try {
      const results = await Promise.allSettled(
        targets.map((row) =>
          updateLabourDailyRecord(labourId, row.recordId, { fooding_pay }),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected");
      await invalidateRecordQueries();
      if (failed.length === 0) {
        toastSuccess("খোরাকি সেট হয়েছে");
        setBulkFooding("");
        document.getElementById(PAYMENT_FILTER_MODAL_ID)?.close();
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
      setBulkFoodingBusy(false);
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

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 py-3">
      {recordsError ? (
        <ApiErrorAlert error={parseApiError(recordsError)} />
      ) : null}

      <div
        className={`flex items-center gap-2 shrink-0 px-3 ${
          SHOW_BILLING ? "justify-between" : "justify-end"
        }`}
      >
        {SHOW_BILLING ? (
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
        ) : null}
        <select
          className="select select-bordered select-sm min-w-0 w-44 max-w-44"
          value={selectedSiteId}
          onChange={(e) => {
            setSiteFilter(e.target.value);
            setBillingFilter("all");
          }}
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
        <table className="table table-sm sm:table-md w-full">
          <thead className="sticky top-0 z-10 bg-base-200">
            <tr className="border-b border-base-300 text-sm">
              <th>নং</th>
              <th>
                <button
                  type="button"
                  onClick={openDateFilter}
                  disabled={!sessionDateBounds}
                >
                  {dateHeaderLabel}
                </button>
              </th>
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
                  {earningsHeaderLabel}
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
                  {paymentHeaderLabel}
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
                const paymentPart = paymentFilter.includes("payment")
                  ? hasAmount(row.payment)
                    ? num(row.payment)
                    : null
                  : null;
                const advancePart = paymentFilter.includes("advance")
                  ? hasAmount(row.advance)
                    ? num(row.advance)
                    : null
                  : null;
                const outflowParts = [paymentPart, advancePart].filter(
                  (v) => v != null,
                );
                const showOutflow = outflowParts.length > 0;
                const outflow = outflowParts.reduce((sum, n) => sum + n, 0);
                const showRet =
                  paymentFilter.includes("return") && hasAmount(row.return);
                const attendanceLines = attendanceCellLines(row, hajiraFilter);
                const hajiraTone =
                  activityTextToneClass(row.activityTone) ||
                  "text-base-content/70";

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

      <dialog id={DATE_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg pr-8 shrink-0">তারিখ</h3>
          <div className="flex flex-col gap-3 pt-3 flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <label className="form-control w-full min-w-0">
                <span className="label-text mb-1">শুরু তারিখ</span>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={draftDateStart}
                  min={sessionDateBounds?.min}
                  max={draftDateEnd || sessionDateBounds?.max}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDraftDateStart(next);
                    if (draftDateEnd && next && next > draftDateEnd) {
                      setDraftDateEnd(next);
                    }
                  }}
                />
              </label>
              <label className="form-control w-full min-w-0">
                <span className="label-text mb-1">শেষ তারিখ</span>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={draftDateEnd}
                  min={draftDateStart || sessionDateBounds?.min}
                  max={sessionDateBounds?.max}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDraftDateEnd(next);
                    if (draftDateStart && next && next < draftDateStart) {
                      setDraftDateStart(next);
                    }
                  }}
                />
              </label>
            </div>
            <div className="modal-action pt-1 flex-wrap justify-between gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={resetDateFilter}
                disabled={!dateFilterActive}
              >
                রিসেট
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={applyDateFilter}
                disabled={!draftDateStart || !draftDateEnd}
              >
                প্রয়োগ করুন
              </button>
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
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {EARNINGS_FILTER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={earningsFilter.includes(option.value)}
                    onChange={() => {
                      setEarningsFilter((prev) =>
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
          <div className="flex flex-col gap-3 pt-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {HAJIRA_FILTER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={hajiraFilter.includes(option.value)}
                    onChange={() => {
                      setHajiraFilter((prev) =>
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
            {canChangeDailyRecord ? (
              <div className="space-y-3 border-t border-base-300 pt-3">
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
                    onChange={(e) => setBulkSalary(numOrEmpty(e.target.value))}
                  />
                </label>
                <div className="modal-action pt-1">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
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
                    সেট করুন
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
          <div className="flex flex-col gap-3 pt-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {PAYMENT_FILTER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="inline-flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={paymentFilter.includes(option.value)}
                    onChange={() => {
                      setPaymentFilter((prev) =>
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
            {canChangeDailyRecord ? (
              <div className="space-y-3 border-t border-base-300 pt-3">
                <label className="form-control w-full">
                  <span className="label-text text-sm">খোরাকি</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    className="input input-bordered input-sm w-full tabular-nums"
                    value={bulkFooding}
                    disabled={bulkFoodingBusy}
                    onChange={(e) => setBulkFooding(numOrEmpty(e.target.value))}
                  />
                </label>
                <div className="modal-action pt-1">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void applyBulkFooding()}
                    disabled={
                      bulkFoodingBusy ||
                      bulkFooding === "" ||
                      bulkFooding == null
                    }
                  >
                    {bulkFoodingBusy ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : null}
                    সেট করুন
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
    </div>
  );
};
