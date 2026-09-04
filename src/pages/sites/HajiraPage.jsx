import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteLabourDailyRecord,
  updateLabourDailyRecord,
} from "../../api/labours.js";
import {
  createSiteDailyRecords,
  fetchAllSiteDailyRecords,
} from "../../api/sites.js";
import {
  buildHajiraRangeRows,
  buildHajiraRowFromEntry,
  buildHajiraRowsFromRoster,
  sumHajiraRangeFooter,
  toDailyRecordPayload,
  toDailyRecordPatchPayload,
} from "../../api/types/hajira.js";
import { applyPendingActivitiesToHajiraRows } from "../../api/types/activity.js";
import { profileAllowedSiteIds } from "../../api/types/user.js";
import { fetchAllActivities, reviewActivities } from "../../api/activities.js";
import { messageForCode, parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { HajiraActionBars } from "../../components/hajiraPage/HajiraActionBars.jsx";
import { HajiraFilterModals } from "../../components/hajiraPage/HajiraFilterModals.jsx";
import { HajiraRangeTable } from "../../components/hajiraPage/HajiraRangeTable.jsx";
import { HajiraRecordsTable } from "../../components/hajiraPage/HajiraRecordsTable.jsx";
import { RecordDetailModal } from "../../components/hajiraPage/RecordDetailModal.jsx";
import {
  BILLING_FILTER_MODAL_ID,
  BULK_ROW_FIX_TOAST,
  EARNINGS_DEFAULT_FIELDS,
  EARNINGS_FILTER_MODAL_ID,
  HAJIRA_FILTER_MODAL_ID,
  LABOUR_DEFAULT_FIELDS,
  LABOUR_FILTER_MODAL_ID,
  MEANINGFUL_DAY_VALUE_MESSAGE,
  MODAL_VIEWS,
  PAYMENT_FILTER_MODAL_ID,
  PAYMENT_SPECS,
  RECORD_MODAL_ID,
} from "../../components/hajiraPage/constants.js";
import {
  advanceAmountOf,
  canSetBillingOnRow,
  cloneRows,
  dayEarnings,
  emptyBulkAttendance,
  emptyBulkBilling,
  emptyBulkPayment,
  formatBulkDailyRecordCreateError,
  formatBulkReviewError,
  hajiraTotalValue,
  hasAmount,
  hasAttendanceData,
  hasMeaningfulDayValue,
  hasPresent,
  isAttendanceDirty,
  isBulkAttendanceDirty,
  isBulkAttendanceZeroInvalid,
  isBulkBillingDirty,
  isBulkPaymentDirty,
  isCreateBlockedByLastSession,
  isPendingCreateRow,
  isRecordDirty,
  isRecordModalDirty,
  lacksMeaningfulDayValue,
  numOrEmpty,
  paymentAmountOf,
  recordIdOf,
  recordModalFromRow,
  recordSealedOf,
  returnAmountOf,
} from "../../components/hajiraPage/helpers.js";
import { useBillingLookup } from "../../hooks/useBillingLookup.js";
import { usePermissions } from "../../hooks/usePermissions.js";
import { useSitesLookup } from "../../hooks/useSites.js";
import { PERMS, hasPermissionSuffix } from "../../utils/permissions.js";
import {
  concatBillingName,
  formatBnNumber,
  NULL_BILLING_LABEL,
} from "../../utils/format.js";
import {
  alertError,
  alertNotice,
  confirmAction,
  escapeHtml,
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
import {
  dateFilterParams,
  eachIsoDate,
  isIsoDate,
  isMultiDaySelection,
} from "../../utils/dateRange.js";
import { SHOW_BILLING } from "../../config/features.js";

export const HajiraPage = () => {
  const { date: selectedDate, dateEnd, siteId: selectedSiteId } =
    useOutletContext();
  const { can, profile, isCompanyAdmin } = usePermissions();
  const { getSiteName } = useSitesLookup();
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

  const showLabourDetailDenied = async (row) => {
    const name = escapeHtml(row?.labourName?.trim() || "এই শ্রমিক");
    const siteLabel = escapeHtml(getSiteName(row?.labourCurrentSite));
    await alertNotice({
      html: `<strong>${name}</strong> এর বর্তমান সাইট <strong>${siteLabel}</strong>। এই সাইটে আপনার <strong>অনুমতি নেই</strong>।`,
      confirmText: "ঠিক আছে",
    });
  };

  const siteId = selectedSiteId || readSelectedSite();
  const date = selectedDate || readSelectedDate() || todayIso();
  const isRange = isMultiDaySelection(date, dateEnd);
  const rangeDates = useMemo(
    () =>
      isRange && isIsoDate(date) ? eachIsoDate(date, dateEnd) : [],
    [isRange, date, dateEnd],
  );
  const showRangeDayColumns =
    isRange && rangeDates.length > 0 && rangeDates.length <= 31;
  const dateParams = useMemo(
    () => dateFilterParams(date, dateEnd),
    [date, dateEnd],
  );

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
  const [modalBaseline, setModalBaseline] = useState(null);
  const [recordModalView, setRecordModalView] = useState(MODAL_VIEWS.detail);
  const [modalEditing, setModalEditing] = useState(false);
  const [modalDeleting, setModalDeleting] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
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
    queryKey: ["sites", siteId, "daily-records", dateParams],
    queryFn: async () => {
      const { data } = await fetchAllSiteDailyRecords(siteId, dateParams);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId && date),
  });

  const billingLookup = useBillingLookup(siteId, { enabled: Boolean(siteId) });
  const billingOptions = billingLookup.activeCategories;
  const getBillingName = billingLookup.getBillingName;

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
    const roster = dailyRecordsQuery.data ?? [];

    let next = buildHajiraRowsFromRoster(roster, {
      siteId,
      includeLabour,
      includeRecord,
      date,
    });
    if (includeLabour) {
      next = withSiteLabourCurrentSite(next);
    }
    if (canViewActivityLog) {
      next = applyPendingActivitiesToHajiraRows(next);
    }
    return next;
  };

  const rangeRows = useMemo(() => {
    if (!isRange) return [];
    const selected = Array.isArray(labourFilter)
      ? labourFilter
      : LABOUR_DEFAULT_FIELDS;
    const includeRecord = selected.includes("record");
    const includeLabour = selected.includes("labour");
    let next = buildHajiraRangeRows(dailyRecordsQuery.data ?? [], {
      siteId,
      includeLabour,
      includeRecord,
      dates: showRangeDayColumns ? rangeDates : [],
    });
    if (includeLabour) {
      next = withSiteLabourCurrentSite(next);
    }
    return next;
  }, [
    isRange,
    labourFilter,
    dailyRecordsQuery.data,
    siteId,
    rangeDates,
    showRangeDayColumns,
  ]);

  const rangeFooter = useMemo(
    () =>
      sumHajiraRangeFooter(
        rangeRows,
        showRangeDayColumns ? rangeDates : [],
      ),
    [rangeRows, showRangeDayColumns, rangeDates],
  );

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
    setModalBaseline(null);
    setRecordModalView(MODAL_VIEWS.detail);
    setModalEditing(false);
    setExpandedHistoryId(null);
    setEarningsFilter([...EARNINGS_DEFAULT_FIELDS]);
    setPaymentFilter(["payment", "advance", "return"]);
    setBillingFilter(["all"]);
    setHajiraFilter(["present", "extra"]);
  }, [siteId, date, dateEnd]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSaveRowErrors({});
  }, [earningsFilter, paymentFilter, billingFilter, hajiraFilter, labourFilter]);

  // Single-mode row rebuild for current labour filter.
  useEffect(() => {
    if (isRange) {
      setRows([]);
      setInitialRows([]);
      return;
    }
    if (!dailyRecordsQuery.isSuccess) return;
    const next = buildRowsForLabourFilter(labourFilter);
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  }, [
    labourFilter,
    canViewActivityLog,
    dailyRecordsQuery.isSuccess,
    dailyRecordsQuery.data,
    siteId,
    date,
    isRange,
  ]);

  useEffect(() => {
    if (recordModal == null) setModalBaseline(null);
  }, [recordModal]);

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

  /** Page bottom confirm is only for new daily-record creates. */
  const hasPendingCreates = useMemo(
    () =>
      rows.some((row) => {
        const initial =
          initialRows.find((r) => r.labourId === row.labourId) ?? row;
        return isPendingCreateRow(row, initial, date);
      }),
    [rows, initialRows, date],
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
    (recordIdOf(row)
      ? !canChangeDailyRecord
      : !canAddDailyRecord || isCreateBlockedByLastSession(row, row.date || date));

  const isLabourOffSite = (row) => {
    if (row?.labourCurrentSite == null || siteId == null || siteId === "") {
      return false;
    }
    return Number(row.labourCurrentSite) !== Number(siteId);
  };

  const isCreateModal = Boolean(recordModal && !recordIdOf(recordModal));
  const modalRecordDate = recordModal?.date || date;
  const modalEditable = Boolean(
    recordModal &&
      !recordSealedOf(recordModal) &&
        (isCreateModal
          ? canAddDailyRecord &&
            !isCreateBlockedByLastSession(recordModal, modalRecordDate)
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
    setModalDeleting(false);
    setModalSaving(false);
  };

  const closeRecordModal = () => {
    document.getElementById(RECORD_MODAL_ID)?.close();
    setRecordModal(null);
    setModalBaseline(null);
    setRecordModalView(MODAL_VIEWS.detail);
    setExpandedHistoryId(null);
    resetModalEditState();
  };

  const openRecordModal = (row) => {
    setRecordModalView(MODAL_VIEWS.detail);
    setExpandedHistoryId(null);
    resetModalEditState();
    setModalBaseline(row);
    setRecordModal(recordModalFromRow(row));
    document.getElementById(RECORD_MODAL_ID)?.showModal();
  };

  const openRangeDay = (rangeRow, day) => {
    if (day?.record) {
      openRecordModal(
        buildHajiraRowFromEntry({
          labour: rangeRow.labour,
          record: day.record,
        }),
      );
      return;
    }
    if (!canAddDailyRecord || !day?.date) return;
    const draft = buildHajiraRowFromEntry({
      labour: rangeRow.labour,
      record: null,
    });
    openRecordModal({ ...draft, date: day.date });
  };

  const startModalEdit = () => {
    if (!canUpdateRecord || !recordModal) return;
    setRecordModalView(MODAL_VIEWS.detail);
    setModalDeleting(false);
    setModalEditing(true);
  };

  const startModalDelete = () => {
    if (!canDeleteRecord || !recordModal) return;
    setRecordModalView(MODAL_VIEWS.detail);
    setModalEditing(false);
    setModalDeleting(true);
  };

  const cancelModalEdit = () => {
    if (!recordModal) return;
    resetRecordModal();
    setModalEditing(false);
  };

  const cancelModalDelete = () => {
    setModalDeleting(false);
  };

  const buildModalRowPatch = () => {
    if (!recordModal) return null;
    const presentEmpty =
      recordModal.present === "" ||
      recordModal.present == null ||
      Number(recordModal.present) === 0;
    const presentNum = presentEmpty ? 0 : Number(recordModal.present);
    const billingAllowed = canSetBillingOnRow(recordModal);
    return {
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
      date: recordModal.date || date,
    };
  };

  /** Stage new rows locally for bulk create confirm on the page. */
  const saveRecordModal = () => {
    if (!recordModal || !modalEditable || attendanceLocked(recordModal)) return;
    if (!isCreateModal) return;
    if (isRange) {
      void persistRangeCreate();
      return;
    }
    const currentRow =
      rows.find((r) => r.labourId === recordModal.labourId) ?? modalBaseline;
    if (!isRecordModalDirty(recordModal, currentRow)) return;
    const next = buildModalRowPatch();
    if (!next) return;
    updateRow(recordModal.labourId, next);
    closeRecordModal();
  };

  const persistRangeCreate = async () => {
    if (!canAddDailyRecord || !recordModal || modalSaving) return;
    const next = buildModalRowPatch();
    if (!next || lacksMeaningfulDayValue(next)) {
      toastInfo(MEANINGFUL_DAY_VALUE_MESSAGE);
      return;
    }
    if (isCreateBlockedByLastSession(recordModal, next.date || date)) {
      toastInfo(messageForCode("record_date_not_after_last_session"));
      return;
    }
    setModalSaving(true);
    try {
      await createSiteDailyRecords(siteId, [
        toDailyRecordPayload(
          { ...recordModal, ...next, labourId: recordModal.labourId },
          next.date,
        ),
      ]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sites", siteId, "daily-records"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["sites", siteId, "daily-reports"],
        }),
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
      ]);
      toastSuccess("হাজিরা তৈরি হয়েছে");
      closeRecordModal();
    } catch (err) {
      toastApiError(parseApiError(err));
    } finally {
      setModalSaving(false);
    }
  };

  /** Existing record: PATCH immediately from the detail modal. */
  const confirmModalUpdate = async () => {
    if (!canUpdateRecord || !recordModal || modalSaving) return;
    const recordId = recordIdOf(recordModal);
    if (recordId == null) return;
    const currentRow =
      rows.find((r) => r.labourId === recordModal.labourId) ?? modalBaseline;
    if (!isRecordModalDirty(recordModal, currentRow)) return;
    const next = buildModalRowPatch();
    if (!next || lacksMeaningfulDayValue(next)) {
      toastInfo(MEANINGFUL_DAY_VALUE_MESSAGE);
      return;
    }

    setModalSaving(true);
    try {
      const payload = toDailyRecordPatchPayload({
        ...(currentRow ?? {}),
        ...next,
        labourId: recordModal.labourId,
      });
      await updateLabourDailyRecord(recordModal.labourId, recordId, payload);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["sites", siteId, "daily-records"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["sites", siteId, "daily-reports"],
        }),
        queryClient.invalidateQueries({ queryKey: ["activities"] }),
      ]);
      toastSuccess("হাজিরা আপডেট হয়েছে");
      closeRecordModal();
    } catch (err) {
      toastApiError(parseApiError(err));
    } finally {
      setModalSaving(false);
    }
  };

  const confirmModalDelete = async () => {
    if (!canDeleteRecord || !recordModal || modalSaving) return;
    const recordId = recordIdOf(recordModal);
    if (recordId == null) return;
    setModalSaving(true);
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
    } finally {
      setModalSaving(false);
    }
  };

  const resetRecordModal = () => {
    if (!recordModal) return;
    const initial =
      initialByLabour.get(recordModal.labourId) ?? modalBaseline;
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
      date: resetForm.date,
    });
  };

  const applyRecordModalDefaults = () => {
    if (!recordModal || !modalEditable || attendanceLocked(recordModal)) return;
    const row =
      rows.find((r) => r.labourId === recordModal.labourId) ?? modalBaseline;
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

  /** Bulk set only fills uncreated rows, and only blank fields on those rows. */
  const isBulkTargetRow = (row) =>
    !recordIdOf(row) && !attendanceLocked(row);

  const showBulkSection =
    !isRange && (canAddDailyRecord || canChangeDailyRecord);
  const bulkSetEnabled = rows.some(isBulkTargetRow);

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
      let blocked = 0;

      for (const row of rows) {
        const initial =
          initialRows.find((r) => r.labourId === row.labourId) ?? row;

        if (recordSealedOf(row)) continue;
        if (recordIdOf(row)) continue;
        if (isCreateBlockedByLastSession(row, row.date || date)) {
          blocked += 1;
          continue;
        }
        if (!isRecordDirty(row, initial)) continue;

        if (hasAttendanceData(row)) {
          if (!canAddDailyRecord) {
            blocked += 1;
            continue;
          }
          createItems.push({
            labourId: row.labourId,
            labourName: row.labourName,
            payload: toDailyRecordPayload(row, row.date || date),
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

      return {
        creates: createItems.length,
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
        recordIdOf(row) ||
        !isAttendanceDirty(row, initial) ||
        recordSealedOf(row) ||
        isCreateBlockedByLastSession(row, row.date || date) ||
        !hasAttendanceData(row)
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
      if (result.creates === 0) {
        toastInfo(
          result.blocked > 0
            ? !canAddDailyRecord
              ? messageForCode("permission_denied")
              : messageForCode("record_date_not_after_last_session")
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

  const loading = dailyRecordsQuery.isLoading;

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const loadError = dailyRecordsQuery.error;
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
        ? "এই সাইটে কোনো শ্রমিক নেই।"
        : includeLabourRows && includeRecordRows
          ? "এই সাইটে কোনো শ্রমিক নেই এবং অন্য কোনো রেকর্ড নেই।"
          : isRange
            ? "এই সময়ে কোনো হাজিরা নেই।"
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
    ? (rows.find((r) => r.labourId === recordModal.labourId) ??
      modalBaseline)
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
    Boolean(String(recordModal.date ?? "").trim()) &&
    (isCreateModal
      ? !isRange || hasMeaningfulDayValue(recordModal)
      : hasMeaningfulDayValue(recordModal));
  const modalRows = rows.length
    ? rows
    : modalBaseline
      ? [modalBaseline]
      : [];

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

      {isRange ? (
        <HajiraRangeTable
          dates={rangeDates}
          showDayColumns={showRangeDayColumns}
          rows={rangeRows}
          emptyMessage={emptyMessage}
          footer={rangeFooter}
          openLabourFilterModal={openLabourFilterModal}
          labourFilter={labourFilter}
          isLabourOffSite={isLabourOffSite}
          canOpenLabourDetail={canOpenLabourDetail}
          showLabourDetailDenied={showLabourDetailDenied}
          canCreateDay={canAddDailyRecord}
          onOpenDay={openRangeDay}
        />
      ) : (
      <HajiraRecordsTable
        selectMode={selectMode}
        canChangeActivityLog={canChangeActivityLog}
        allPendingSelected={allPendingSelected}
        somePendingSelected={somePendingSelected}
        pendingIds={pendingIds}
        toggleSelectAll={toggleSelectAll}
        setSelectMode={setSelectMode}
        openLabourFilterModal={openLabourFilterModal}
        labourFilter={labourFilter}
        openHajiraModal={openHajiraModal}
        hajiraFilter={hajiraFilter}
        showAyColumn={showAyColumn}
        openEarningsFilterModal={openEarningsFilterModal}
        earningsFilter={earningsFilter}
        openPaymentModal={openPaymentModal}
        paymentFilter={paymentFilter}
        openBillingModal={openBillingModal}
        billingFilterHeaderLabel={billingFilterHeaderLabel}
        tableColCount={tableColCount}
        visibleRows={visibleRows}
        emptyMessage={emptyMessage}
        initialByLabour={initialByLabour}
        activityIdsForRow={activityIdsForRow}
        selectedIds={selectedIds}
        viewEarningsFilter={viewEarningsFilter}
        viewPaymentFilter={viewPaymentFilter}
        showReturnAmount={showReturnAmount}
        viewHajiraFields={viewHajiraFields}
        billingFullLabelForRow={billingFullLabelForRow}
        saveRowErrors={saveRowErrors}
        isLabourOffSite={isLabourOffSite}
        openRecordModal={openRecordModal}
        toggleRowSelected={toggleRowSelected}
        canOpenLabourDetail={canOpenLabourDetail}
        showLabourDetailDenied={showLabourDetailDenied}
        billingLabelForRow={billingLabelForRow}
        totals={totals}
        date={date}
      />
      )}

      {isRange ? null : (
      <HajiraActionBars
        hasPendingCreates={hasPendingCreates}
        onCancel={onCancel}
        saving={saving}
        onSave={onSave}
        rows={rows}
        selectMode={selectMode}
        canChangeActivityLog={canChangeActivityLog}
        reviewing={reviewing}
        exitSelectMode={exitSelectMode}
        selectedIds={selectedIds}
        onAcceptChanges={onAcceptChanges}
      />
      )}

      <RecordDetailModal
        recordModal={recordModal}
        setRecordModal={setRecordModal}
        recordModalView={recordModalView}
        setRecordModalView={setRecordModalView}
        canViewActivityLog={canViewActivityLog}
        canShowRecordHistory={canShowRecordHistory}
        modalEditing={modalEditing}
        modalDeleting={modalDeleting}
        resetModalEditState={resetModalEditState}
        setExpandedHistoryId={setExpandedHistoryId}
        historyIsLoading={entityHistoryQuery.isLoading}
        historyError={
          entityHistoryQuery.isError ? entityHistoryQuery.error : null
        }
        recordHistoryLogs={recordHistoryLogs}
        expandedHistoryId={expandedHistoryId}
        billingFullLabel={billingFullLabel}
        modalEditable={modalEditable}
        rows={modalRows}
        patchRecordModal={patchRecordModal}
        recordModalLocked={recordModalLocked}
        salaryFieldEnabled={salaryFieldEnabled}
        billingFieldEnabled={billingFieldEnabled}
        billingOptions={billingOptions}
        isCreateModal={isCreateModal}
        resetRecordModal={resetRecordModal}
        applyRecordModalDefaults={applyRecordModalDefaults}
        saveRecordModal={saveRecordModal}
        recordModalCanSet={recordModalCanSet}
        recordModalDirty={recordModalDirty}
        cancelModalEdit={cancelModalEdit}
        modalSaving={modalSaving}
        confirmModalUpdate={confirmModalUpdate}
        billingFullLabelForRow={billingFullLabelForRow}
        canDeleteRecord={canDeleteRecord}
        cancelModalDelete={cancelModalDelete}
        confirmModalDelete={confirmModalDelete}
        canDeleteDailyRecord={canDeleteDailyRecord}
        startModalDelete={startModalDelete}
        canUpdateRecord={canUpdateRecord}
        canChangeDailyRecord={canChangeDailyRecord}
        startModalEdit={startModalEdit}
        date={date}
      />

      <HajiraFilterModals
        labourFilter={labourFilter}
        setLabourFilter={setLabourFilter}
        earningsFilter={earningsFilter}
        setEarningsFilter={setEarningsFilter}
        hajiraFilter={hajiraFilter}
        setHajiraFilter={setHajiraFilter}
        showBulkSection={showBulkSection}
        bulkSetEnabled={bulkSetEnabled}
        bulkAttendance={bulkAttendance}
        setBulkAttendance={setBulkAttendance}
        onHajiraBulkReset={onHajiraBulkReset}
        hasHajiraBulkReset={hasHajiraBulkReset}
        onHajiraBulkDefault={onHajiraBulkDefault}
        onHajiraBulkCustom={onHajiraBulkCustom}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
        bulkPayment={bulkPayment}
        setBulkPayment={setBulkPayment}
        onPaymentBulkReset={onPaymentBulkReset}
        hasPaymentBulkReset={hasPaymentBulkReset}
        onPaymentBulkDefault={onPaymentBulkDefault}
        onPaymentBulkCustom={onPaymentBulkCustom}
        billingFilterOptions={billingFilterOptions}
        billingFilter={billingFilter}
        toggleBillingFilter={toggleBillingFilter}
        onBillingBulkCustom={onBillingBulkCustom}
        billingOptions={billingOptions}
        onBillingBulkReset={onBillingBulkReset}
        hasBillingBulkReset={hasBillingBulkReset}
      />
    </div>
  );
};
