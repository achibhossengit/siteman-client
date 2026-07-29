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
import { messageForCode, parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { PERMS } from "../../utils/permissions.js";
import { formatBnNumber } from "../../utils/format.js";
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

const dayEarnings = (row) => {
  const present = hasPresent(row) ? Number(row.present) : 0;
  const salary =
    row.salary === "" || row.salary == null ? 0 : Number(row.salary);
  return present * salary + (Number(row.extra) || 0);
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

const hasPaymentDisplay = (row) =>
  (row.payment !== "" && Number(row.payment) !== 0) ||
  (row.return !== "" && Number(row.return) !== 0);

export const HajiraPage = () => {
  const { date: selectedDate, siteId: selectedSiteId, sites } =
    useOutletContext();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const canAddAttendance = can(PERMS.addAttendance);
  const canChangeAttendance = can(PERMS.changeAttendance);
  const canAddPayment = can(PERMS.addLabourPayment);
  const canChangePayment = can(PERMS.changeLabourPayment);

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
  const [paymentTab, setPaymentTab] = useState(PAYMENT_SPECS[0].key);

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

  const billingOptions = billingQuery.data ?? [];

  const billingLabelById = useMemo(() => {
    const map = new Map();
    for (const b of billingOptions) map.set(String(b.id), b.name);
    return map;
  }, [billingOptions]);

  const billingLabel = (id) => {
    if (id == null || id === "") return "—";
    return billingLabelById.get(String(id)) ?? `#${id}`;
  };

  // Exit edit mode when site/date changes.
  useEffect(() => {
    setEditing(false);
    setApiError(null);
    setHajiraModal(null);
    setPaymentModal(null);
  }, [siteId, date]);

  // View mode: map records by labour from attendance/payment only.
  useEffect(() => {
    if (editing) return;
    if (!attendanceQuery.isSuccess || !paymentQuery.isSuccess) return;
    const next = buildHajiraViewRows(
      attendanceQuery.data ?? [],
      paymentQuery.data ?? [],
    );
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
  }, [
    editing,
    attendanceQuery.isSuccess,
    paymentQuery.isSuccess,
    attendanceQuery.data,
    paymentQuery.data,
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
    });
    document.getElementById(HAJIRA_MODAL_ID)?.showModal();
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
      return: row.return,
      returnNote: row.returnNote ?? "",
      returnSealed: row.returnSealed,
      returnId: row.returnId,
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

  const onAddHajira = () => {
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
        setApiError(
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
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 px-3 py-3">
      {apiError ? <ApiErrorAlert error={apiError} /> : null}

      <div className="overflow-x-auto">
        <table className="table table-xs sm:table-sm">
          <thead>
            <tr className="border-b border-base-300">
              <th>নং</th>
              <th>নাম</th>
              <th>হাজিরা</th>
              <th className="text-right">আয়</th>
              <th className="text-right">পেমেন্ট</th>
              <th>বিলিং</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const initial = initialByLabour.get(row.labourId) ?? {};
                const hajiraTone = editing
                  ? fieldTone(
                      row,
                      initial,
                      ["present", "salary", "extra", "extraNote"],
                      "attendanceId",
                    )
                  : "text-base-content/60";
                const earn = dayEarnings(row);

                return (
                  <tr
                    key={row.labourId}
                    className="border-b border-base-300/70"
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
                        {hasPresent(row) || hasExtra(row) ? (
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
                        {hasPaymentDisplay(row) ? (
                          <span className="block tabular-nums space-y-0.5">
                            {row.payment !== "" &&
                            Number(row.payment) !== 0 ? (
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
                            {row.return !== "" &&
                            Number(row.return) !== 0 ? (
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
                        <select
                          className={`select select-bordered select-xs w-24 sm:w-28 ${fieldTone(row, initial, "billing", "attendanceId")}`}
                          value={row.billing}
                          disabled={attendanceLocked(row)}
                          onChange={(e) =>
                            updateRow(row.labourId, {
                              billing: e.target.value,
                            })
                          }
                          aria-label={`${row.labourName} বিলিং`}
                        >
                          <option value="">—</option>
                          {billingOptions.map((b) => (
                            <option key={b.id} value={String(b.id)}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-base-content/70 truncate">
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

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {editing ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onUseDefaults}
              disabled={saving || rows.length === 0}
            >
              Use Defaults
            </button>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onSave}
                disabled={saving || !isDirty || rows.length === 0}
              >
                {saving ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                Save
              </button>
            </div>
          </>
        ) : canAddAttendance ? (
          <button
            type="button"
            className="btn btn-primary btn-sm ml-auto"
            onClick={onAddHajira}
            disabled={!date || siteInactive}
          >
            Add Hajira
          </button>
        ) : null}
      </div>

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
                <span className="label-text text-sm">অতিরিক্ত</span>
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
    </div>
  );
};
