import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
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
} from "../../api/types/hajira.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { useAuth } from "../../providers/AuthProvider.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { PERMS } from "../../utils/permissions.js";
import { paths } from "../../router/paths.js";
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
  const salary = row.salary === "" || row.salary == null ? 0 : Number(row.salary);
  return present * salary + (Number(row.extra) || 0);
};

const attendancePayload = (row, date) => ({
  labour: row.labourId,
  date,
  present: hasPresent(row) ? Number(row.present) : null,
  salary: row.salary === "" || row.salary == null ? null : Number(row.salary),
  extra: Number(row.extra) || 0,
  note: row.extraNote?.trim() ? row.extraNote.trim() : null,
  billing: row.billing === "" || row.billing == null ? null : Number(row.billing),
});

const attendancePatchPayload = (row) => ({
  present: hasPresent(row) ? Number(row.present) : null,
  salary: row.salary === "" || row.salary == null ? null : Number(row.salary),
  extra: Number(row.extra) || 0,
  note: row.extraNote?.trim() ? row.extraNote.trim() : null,
  billing: row.billing === "" || row.billing == null ? null : Number(row.billing),
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

const formatTitleDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
};

const HAJIRA_MODAL_ID = "hajira_attendance_modal";
const PAYMENT_MODAL_ID = "hajira_payment_modal";

const PAYMENT_SPECS = [
  {
    key: "fooding",
    noteKey: "foodingNote",
    idKey: "foodingId",
    sealedKey: "foodingSealed",
    type: "payment",
    category: "fooding",
    label: "খোরাকি",
  },
  {
    key: "advance",
    noteKey: "advanceNote",
    idKey: "advanceId",
    sealedKey: "advanceSealed",
    type: "payment",
    category: "advance",
    label: "অগ্রিম",
  },
  {
    key: "return",
    noteKey: "returnNote",
    idKey: "returnId",
    sealedKey: "returnSealed",
    type: "return",
    category: null,
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

/** Unchanged payments keep type color (error/success); dirty uses create/update tone. */
const paymentLineTone = (row, initial, keys, idKey, typeClass) => {
  const tone = fieldTone(row, initial, keys, idKey);
  return tone === "text-base-content/60" ? typeClass : tone;
};

const hasPaymentDisplay = (row) =>
  (row.fooding !== "" && Number(row.fooding) !== 0) ||
  (row.advance !== "" && Number(row.advance) !== 0) ||
  (row.return !== "" && Number(row.return) !== 0);

export const HajiraNewPage = () => {
  const navigate = useNavigate();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const canAddAttendance = can(PERMS.addAttendance);
  const canChangeAttendance = can(PERMS.changeAttendance);
  const canAddPayment = can(PERMS.addLabourPayment);
  const canChangePayment = can(PERMS.changeLabourPayment);
  const canEdit = canAddAttendance || canChangeAttendance;

  const siteId = readSelectedSite();
  const date = readSelectedDate() || todayIso();
  const site = (profile?.sites ?? []).find(
    (s) => String(s.id) === String(siteId),
  );

  const [rows, setRows] = useState([]);
  const [initialRows, setInitialRows] = useState([]);
  const [rowsReady, setRowsReady] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hajiraModal, setHajiraModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentTab, setPaymentTab] = useState(PAYMENT_SPECS[0].key);

  useEffect(() => {
    setTitle?.(date ? `হাজিরা (${formatTitleDate(date)})` : "হাজিরা");
    return () => setTitle?.("");
  }, [setTitle, date]);

  useEffect(() => {
    setHeaderMenu?.(
      site?.name ? (
        <span className="text-sm font-medium text-base-content/80 truncate px-1">
          {site.name}
        </span>
      ) : null,
    );
    return () => setHeaderMenu?.(null);
  }, [site?.name, setHeaderMenu]);

  const laboursQuery = useQuery({
    queryKey: ["labours", { current_site: siteId, is_active: true }],
    queryFn: async () => {
      const { data } = await fetchLabours({
        current_site: siteId,
        is_active: true,
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(canEdit && siteId),
  });

  const attendanceQuery = useQuery({
    queryKey: ["sites", siteId, "labour-attendances", { date }],
    queryFn: async () => {
      const { data } = await fetchLabourAttendances(siteId, { date });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(canEdit && siteId && date),
  });

  const paymentQuery = useQuery({
    queryKey: ["sites", siteId, "labour-payments", { date }],
    queryFn: async () => {
      const { data } = await fetchLabourPayments(siteId, { date });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(canEdit && siteId && date),
  });

  const billingQuery = useQuery({
    queryKey: ["sites", siteId, "billing-categories", { is_active: true }],
    queryFn: async () => {
      const { data } = await fetchBillingCategories(siteId, {
        is_active: true,
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(canEdit && siteId),
  });

  const dataFingerprint = useMemo(() => {
    if (
      !laboursQuery.isSuccess ||
      !attendanceQuery.isSuccess ||
      !paymentQuery.isSuccess
    ) {
      return null;
    }
    return JSON.stringify({
      labours: laboursQuery.data,
      attendances: attendanceQuery.data,
      payments: paymentQuery.data,
    });
  }, [
    laboursQuery.isSuccess,
    attendanceQuery.isSuccess,
    paymentQuery.isSuccess,
    laboursQuery.data,
    attendanceQuery.data,
    paymentQuery.data,
  ]);

  useEffect(() => {
    if (!dataFingerprint) return;
    const next = buildHajiraEditRows(
      laboursQuery.data ?? [],
      attendanceQuery.data ?? [],
      paymentQuery.data ?? [],
    );
    setRows(cloneRows(next));
    setInitialRows(cloneRows(next));
    setRowsReady(true);
  }, [dataFingerprint, laboursQuery.data, attendanceQuery.data, paymentQuery.data]);

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

  const openHajiraModal = (row) => {
    if (row.attendanceSealed) return;
    setHajiraModal({
      labourId: row.labourId,
      labourName: row.labourName,
      present: row.present === "" ? "" : String(row.present),
      salary: row.salary,
      extra: row.extra || "",
      note: row.extraNote ?? "",
    });
    document.getElementById(HAJIRA_MODAL_ID)?.showModal();
  };

  const saveHajiraModal = () => {
    if (!hajiraModal) return;
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
    if (row.foodingSealed && row.advanceSealed && row.returnSealed) return;
    const firstOpen =
      PAYMENT_SPECS.find((spec) => !row[spec.sealedKey]) ?? PAYMENT_SPECS[0];
    setPaymentTab(firstOpen.key);
    setPaymentModal({
      labourId: row.labourId,
      labourName: row.labourName,
      fooding: row.fooding,
      foodingNote: row.foodingNote ?? "",
      foodingSealed: row.foodingSealed,
      advance: row.advance,
      advanceNote: row.advanceNote ?? "",
      advanceSealed: row.advanceSealed,
      return: row.return,
      returnNote: row.returnNote ?? "",
      returnSealed: row.returnSealed,
    });
    document.getElementById(PAYMENT_MODAL_ID)?.showModal();
  };

  const savePaymentModal = () => {
    if (!paymentModal) return;
    updateRow(paymentModal.labourId, {
      fooding: numOrEmpty(paymentModal.fooding),
      foodingNote: paymentModal.foodingNote ?? "",
      advance: numOrEmpty(paymentModal.advance),
      advanceNote: paymentModal.advanceNote ?? "",
      return: numOrEmpty(paymentModal.return),
      returnNote: paymentModal.returnNote ?? "",
    });
    document.getElementById(PAYMENT_MODAL_ID)?.close();
  };

  /** Resets only the active section — each section is its own payment object. */
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

  const onUseDefaults = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        present:
          row.present === "" || row.present == null
            ? row.defaultAttendance
            : row.present,
        salary:
          row.salary === "" || row.salary == null
            ? row.defaultSalary
            : row.salary,
        fooding:
          row.fooding === "" || row.fooding == null
            ? row.defaultFooding
            : row.fooding,
      })),
    );
  };

  const onReset = () => {
    setRows(cloneRows(initialRows));
    setApiError(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const attendanceCreates = [];
      const attendanceUpdates = [];
      const paymentCreates = [];
      const paymentUpdates = [];

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
            }
          } else if (canAddAttendance && hasAttendanceData(row)) {
            attendanceCreates.push(attendancePayload(row, date));
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
            if (!canChangePayment) continue;
            paymentUpdates.push({
              labourId: row.labourId,
              id,
              payload: {
                amount: amount ?? 0,
                note,
              },
            });
          } else if (amount != null && amount > 0) {
            if (!canAddPayment) continue;
            paymentCreates.push({
              labour: row.labourId,
              date,
              type: spec.type,
              category: spec.category,
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
        setApiError("সেভ করার মতো কোনো পরিবর্তন নেই।");
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
      navigate(paths.hajira, { replace: true });
    } catch (err) {
      setApiError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    );
  }

  if (!siteId) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        হাজিরা এন্ট্রির জন্য একটি সাইট নির্বাচন করুন।
      </div>
    );
  }

  const loading =
    laboursQuery.isLoading ||
    attendanceQuery.isLoading ||
    paymentQuery.isLoading ||
    !rowsReady;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const loadError =
    laboursQuery.error || attendanceQuery.error || paymentQuery.error;
  if (loadError) {
    return <ApiErrorAlert error={parseApiError(loadError)} />;
  }

  const billingOptions = billingQuery.data ?? [];

  return (
    <div className="space-y-3">
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
                  এই সাইটে কোনো সক্রিয় লেবার নেই।
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const initial = initialByLabour.get(row.labourId) ?? {};
                const hajiraTone = fieldTone(
                  row,
                  initial,
                  ["present", "salary", "extra", "extraNote"],
                  "attendanceId",
                );
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
                        disabled={row.attendanceSealed}
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
                    <td
                      className={`text-right tabular-nums ${hajiraTone}`}
                    >
                      {earn ? formatBnNumber(earn) : "—"}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs h-auto min-h-0 px-1 py-0.5 font-normal text-right leading-tight w-full"
                        disabled={
                          row.foodingSealed &&
                          row.advanceSealed &&
                          row.returnSealed
                        }
                        onClick={() => openPaymentModal(row)}
                      >
                        {hasPaymentDisplay(row) ? (
                          <span className="block tabular-nums space-y-0.5">
                            {row.fooding !== "" &&
                            Number(row.fooding) !== 0 ? (
                              <span
                                className={`block ${paymentLineTone(row, initial, ["fooding", "foodingNote"], "foodingId", "text-error")}`}
                              >
                                {formatBnNumber(row.fooding)}
                              </span>
                            ) : null}
                            {row.advance !== "" &&
                            Number(row.advance) !== 0 ? (
                              <span
                                className={`block ${paymentLineTone(row, initial, ["advance", "advanceNote"], "advanceId", "text-error")}`}
                              >
                                {formatBnNumber(row.advance)}
                              </span>
                            ) : null}
                            {row.return !== "" &&
                            Number(row.return) !== 0 ? (
                              <span
                                className={`block ${paymentLineTone(row, initial, ["return", "returnNote"], "returnId", "text-success")}`}
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
                      <select
                        className={`select select-bordered select-xs w-24 sm:w-28 ${fieldTone(row, initial, "billing", "attendanceId")}`}
                        value={row.billing}
                        disabled={row.attendanceSealed}
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
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
            onClick={onReset}
            disabled={saving || !isDirty}
          >
            Reset
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
      </div>

      {/* Hajira modal: present + salary + extra + note */}
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
                  onChange={(e) =>
                    setHajiraModal((m) => ({
                      ...m,
                      note: e.target.value,
                    }))
                  }
                  maxLength={255}
                />
              </label>

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
            </div>
          ) : null}
        </div>
      </dialog>

      {/* Payment modal: fooding / advance / return each = one payment object */}
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
                    disabled={paymentModal[spec.sealedKey]}
                    onClick={() => setPaymentTab(spec.key)}
                  >
                    {spec.label}
                  </button>
                ))}
              </div>

              {PAYMENT_SPECS.filter((spec) => spec.key === paymentTab).map(
                (spec) => (
                  <div key={spec.key} className="space-y-3">
                    <label className="form-control w-full">
                      <span className="label-text text-sm">নোট</span>
                      <input
                        type="text"
                        className="input input-bordered input-sm w-full"
                        value={paymentModal[spec.noteKey]}
                        disabled={paymentModal[spec.sealedKey]}
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
                        disabled={paymentModal[spec.sealedKey]}
                        onChange={(e) =>
                          setPaymentModal((m) => ({
                            ...m,
                            [spec.key]: numOrEmpty(e.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                ),
              )}

              <div className="modal-action pt-1 justify-between">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={resetPaymentModal}
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
            </div>
          ) : null}
        </div>
      </dialog>
    </div>
  );
};
