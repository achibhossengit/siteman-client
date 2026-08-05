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
  activityToneClass,
  applyActivitiesToViewRows,
} from "../../api/types/activity.js";
import { fetchActivities } from "../../api/activities.js";
import { messageForCode, parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { PERMS, hasPermissionSuffix } from "../../utils/permissions.js";
import { concatBillingName, formatBnNumber } from "../../utils/format.js";
import { toastInfo, toastSuccess } from "../../utils/feedback.js";
import {
  readSelectedDate,
  readSelectedSite,
  todayIso,
} from "../../utils/sessionSelection.js";

const cloneRows = (rows) => structuredClone(rows);

const numOrEmpty = (value) => {
  if (value === "" || value == null) return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
};

const hasPresent = (row) => row.present !== "" && row.present != null;

const hasExtra = (row) => Number(row.extra) > 0;

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
    return row.salary !== "" && row.salary != null ? Number(row.salary) || 0 : 0;
  }
  if (hajiraFilter === "extra") return Number(row.extra) || 0;
  return hasPresent(row) ? Number(row.present) || 0 : 0;
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
const BILLING_MODAL_ID = "hajira_billing_modal";
const EARNINGS_FILTER_MODAL_ID = "hajira_earnings_filter_modal";
const PAYMENT_FILTER_MODAL_ID = "hajira_payment_filter_modal";
const BILLING_FILTER_MODAL_ID = "hajira_billing_filter_modal";
const HAJIRA_FILTER_MODAL_ID = "hajira_hajira_filter_modal";

const HAJIRA_FILTER_OPTIONS = [
  { value: "hajira", label: "হাজিরা" },
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
  const { can, profile } = usePermissions();
  const queryClient = useQueryClient();

  const canAddAttendance = can(PERMS.addAttendance);
  const canChangeAttendance = can(PERMS.changeAttendance);
  const canAddPayment = can(PERMS.addLabourPayment);
  const canChangePayment = can(PERMS.changeLabourPayment);
  const canViewActivityLog =
    can(PERMS.viewActivityLog) ||
    hasPermissionSuffix(profile, "view_activitylog");

  const siteId = selectedSiteId || readSelectedSite();
  const date = selectedDate || readSelectedDate() || todayIso();
  const site = (sites ?? []).find((s) => String(s.id) === String(siteId));
  const siteInactive = site?.is_active === false;

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState([]);
  const [initialRows, setInitialRows] = useState([]);
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hajiraModal, setHajiraModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [billingModal, setBillingModal] = useState(null);
  const [paymentTab, setPaymentTab] = useState(PAYMENT_SPECS[0].key);
  const [earningsFilter, setEarningsFilter] = useState("earn");
  const [paymentFilter, setPaymentFilter] = useState("payment");
  const [billingFilter, setBillingFilter] = useState("all");
  const [hajiraFilter, setHajiraFilter] = useState("hajira");

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

  const billingOptions = billingQuery.data ?? [];

  const billingLabelById = useMemo(() => {
    const map = new Map();
    for (const b of billingOptions) map.set(String(b.id), b.name);
    return map;
  }, [billingOptions]);

  const billingFullLabel = (id) => {
    if (id == null || id === "") return "—";
    return billingLabelById.get(String(id)) ?? `#${id}`;
  };

  const billingLabel = (id) => {
    if (id == null || id === "") return "—";
    const full = billingLabelById.get(String(id));
    if (!full) return `#${id}`;
    return concatBillingName(full);
  };

  const billingFilterOptions = useMemo(
    () => [
      { value: "all", label: "বিলিং" },
      { value: "none", label: "—" },
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
        ? "—"
        : billingLabel(billingFilter);

  // Exit edit mode when site/date changes.
  useEffect(() => {
    setEditing(false);
    setApiError(null);
    setHajiraModal(null);
    setPaymentModal(null);
    setEarningsFilter("earn");
    setPaymentFilter("payment");
    setBillingFilter("all");
    setHajiraFilter("hajira");
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
      if (viewPaymentFilter === "return") {
        ret += rtn;
      } else if (viewPaymentFilter === "payment") {
        payment += pay;
      } else {
        payment += pay;
        ret += rtn;
      }
    }
    return { present, earnings, payment, return: ret };
  }, [visibleRows, viewEarningsFilter, viewPaymentFilter, viewHajiraFilter]);

  const showPaymentAmount = (row) =>
    viewPaymentFilter !== "return" && paymentAmountOf(row) !== 0;

  const showReturnAmount = (row) =>
    viewPaymentFilter !== "payment" && returnAmountOf(row) !== 0;

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
      attendanceSealed: row.attendanceSealed,
      attendanceId: row.attendanceId,
      attendanceCreatedAt: row.attendanceCreatedAt ?? null,
      attendanceUpdatedAt: row.attendanceUpdatedAt ?? null,
    });
    document.getElementById(HAJIRA_MODAL_ID)?.showModal();
  };

  const openBillingModal = (row) => {
    if (attendanceLocked(row)) return;
    setBillingModal({
      labourId: row.labourId,
      labourName: row.labourName,
      value: row.billing ?? "",
    });
    document.getElementById(BILLING_MODAL_ID)?.showModal();
  };

  const pickBilling = (billingId) => {
    if (!billingModal) return;
    updateRow(billingModal.labourId, { billing: billingId });
    document.getElementById(BILLING_MODAL_ID)?.close();
  };

  const saveHajiraModal = () => {
    if (!hajiraModal || !modalEditable || attendanceLocked(hajiraModal)) return;
    updateRow(hajiraModal.labourId, {
      present:
        hajiraModal.present === "" ? "" : Number(hajiraModal.present),
      salary: numOrEmpty(hajiraModal.salary),
      extra:
        hajiraModal.extra === "" || hajiraModal.extra == null
          ? 0
          : Number(hajiraModal.extra),
      extraNote: hajiraModal.note ?? "",
    });
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

  const onStartEdit = () => {
    setApiError(null);
    setEditing(true);
  };

  const onUseDefaults = () => {
    const isBlank = (value) => value === "" || value == null;
    const paymentSpec = PAYMENT_SPECS[0];
    setRows((prev) =>
      prev.map((row) => {
        const skipAttendance = attendanceLocked(row);
        const skipPayment = paymentSlotLocked(row, paymentSpec);
        return {
          ...row,
          present:
            !skipAttendance && isBlank(row.present)
              ? row.defaultAttendance
              : row.present,
          salary:
            !skipAttendance && isBlank(row.salary)
              ? row.defaultSalary
              : row.salary,
          payment:
            !skipPayment && isBlank(row.payment)
              ? row.defaultFooding
              : row.payment,
        };
      }),
    );
  };

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
      setEditing(false);
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
        <table className="table table-fixed table-xs sm:table-sm w-full">
          <colgroup>
            <col className="w-10" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-base-100">
            <tr className="border-b border-base-300 text-sm">
              <th>নং</th>
              <th>নাম</th>
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
                    className=""
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
                    className=""
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
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const initial = initialByLabour.get(row.labourId) ?? {};
                const hajiraTone = editing
                  ? fieldTone(
                      row,
                      initial,
                      ["present", "salary", "extra", "extraNote"],
                      "attendanceId",
                    )
                  : "text-base-content/60";
                const earn = dayEarnings(row, viewEarningsFilter);
                const showPay = showPaymentAmount(row);
                const showRet = showReturnAmount(row);
                const hajiraValue = hajiraFieldValue(row, viewHajiraFilter);

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
                    <td>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-xs h-auto min-h-0 px-1 py-0.5 font-normal text-left leading-tight ${hajiraTone}`}
                        onClick={() => openHajiraModal(row)}
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
                          <span>—</span>
                        )}
                      </button>
                    </td>
                    <td className={`text-right tabular-nums ${hajiraTone}`}>
                      {earn ? formatBnNumber(earn) : "—"}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs h-auto min-h-0 px-1 py-0.5 font-normal text-right leading-tight w-full"
                        onClick={() => openPaymentModal(row)}
                      >
                        {showPay || showRet ? (
                          <span className="block tabular-nums space-y-0.5">
                            {showPay ? (
                              <span
                                className={`block ${
                                  editing
                                    ? paymentLineTone(
                                        row,
                                        initial,
                                        ["payment", "paymentNote"],
                                        "paymentId",
                                        "text-error",
                                      )
                                    : "text-error"
                                }`}
                              >
                                {formatBnNumber(row.payment)}
                              </span>
                            ) : null}
                            {showRet ? (
                              <span
                                className={`block ${
                                  editing
                                    ? paymentLineTone(
                                        row,
                                        initial,
                                        ["return", "returnNote"],
                                        "returnId",
                                        "text-success",
                                      )
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
                      {editing ? (
                        <button
                          type="button"
                          className={`btn btn-ghost btn-xs h-auto min-h-0 px-1 font-normal ${fieldTone(row, initial, "billing", "attendanceId")}`}
                          disabled={attendanceLocked(row)}
                          onClick={() => openBillingModal(row)}
                          aria-label={`${row.labourName} বিলিং`}
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
          {visibleRows.length > 0 ? (
            <tfoot>
              <tr className="font-medium border-t border-base-300">
                <td />
                <td className="whitespace-nowrap">Total</td>
                <td className="tabular-nums">
                  {totals.present ? formatBnNumber(totals.present) : "—"}
                </td>
                <td className="text-right tabular-nums">
                  {totals.earnings ? formatBnNumber(totals.earnings) : "—"}
                </td>
                <td className="text-right">
                  {totals.payment || totals.return ? (
                    <span className="block tabular-nums space-y-0.5">
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
                    <span className="text-base-content/60">—</span>
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {editing ? (
        <>
          <button
            type="button"
            className="btn btn-outline btn-primary fixed bottom-16 left-4 z-40 shadow-lg bg-base-100"
            onClick={onUseDefaults}
            disabled={saving || rows.length === 0}
          >
            ডিফল্ট
          </button>
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
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-outline btn-primary fixed bottom-16 left-4 z-40 shadow-lg bg-base-100"
            disabled={!date}
          >
            সব রিভিউ
          </button>
          {canAddAttendance ? (
            <button
              type="button"
              className="btn btn-primary fixed bottom-16 right-4 z-40 shadow-lg"
              onClick={onStartEdit}
              disabled={!date || siteInactive}
            >
              আপডেট
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
              <label className="form-control w-full">
                <span className="label-text text-sm">হাজিরা</span>
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
              </label>

              <label className="form-control w-full">
                <span className="label-text text-sm">বেতন</span>
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
              </label>

              <label className="form-control w-full">
                <span className="label-text text-sm">বাড়তি</span>
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
              </label>

              <label className="form-control w-full">
                <span className="label-text text-sm">নোট</span>
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
              </label>

              {!hajiraModalLocked ? (
                <div className="modal-action pt-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={resetHajiraModal}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={saveHajiraModal}
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
                  return (
                    <div key={spec.key} className="space-y-3">
                      <label className="form-control w-full">
                        <span className="label-text text-sm">নোট</span>
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
                      </label>
                      <label className="form-control w-full">
                        <span className="label-text text-sm">পরিমাণ</span>
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
                      </label>
                    </div>
                  );
                },
              )}

              {modalEditable ? (
                <div className="modal-action pt-1 justify-between">
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
          <h3 className="font-bold text-lg">
            বিলিং
            {billingModal?.labourName
              ? ` (${billingModal.labourName})`
              : ""}
          </h3>
          <div className="menu bg-base-100 w-full p-0 pt-3">
            <button
              type="button"
              className={`btn btn-ghost btn-sm justify-start ${
                !billingModal?.value ? "btn-active" : ""
              }`}
              onClick={() => pickBilling("")}
            >
              —
            </button>
            {billingOptions.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn btn-ghost btn-sm justify-start ${
                  String(billingModal?.value) === String(b.id)
                    ? "btn-active"
                    : ""
                }`}
                onClick={() => pickBilling(String(b.id))}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog id={HAJIRA_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-xs">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg">হাজিরা ফিল্টার</h3>
          <div className="menu bg-base-100 w-full p-0 pt-3">
            {HAJIRA_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn btn-ghost btn-sm justify-start ${
                  hajiraFilter === opt.value ? "btn-active" : ""
                }`}
                onClick={() => {
                  setHajiraFilter(opt.value);
                  document.getElementById(HAJIRA_FILTER_MODAL_ID)?.close();
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

      <dialog id={BILLING_FILTER_MODAL_ID} className="modal">
        <div className="modal-box max-w-xs">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg">বিলিং ফিল্টার</h3>
          <div className="menu bg-base-100 w-full p-0 pt-3">
            {billingFilterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn btn-ghost btn-sm justify-start ${
                  billingFilter === opt.value ? "btn-active" : ""
                }`}
                onClick={() => {
                  setBillingFilter(opt.value);
                  document.getElementById(BILLING_FILTER_MODAL_ID)?.close();
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
          <h3 className="font-bold text-lg">পেমেন্ট ফিল্টার</h3>
          <div className="menu bg-base-100 w-full p-0 pt-3">
            {PAYMENT_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn btn-ghost btn-sm justify-start ${
                  paymentFilter === opt.value ? "btn-active" : ""
                }`}
                onClick={() => {
                  setPaymentFilter(opt.value);
                  document.getElementById(PAYMENT_FILTER_MODAL_ID)?.close();
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
    </div>
  );
};
