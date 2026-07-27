import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CalendarDays,
  Check,
  CircleHelp,
  HardHat,
  Info,
  MapPin,
  Trash2,
  UserRoundPen,
  X,
} from "lucide-react";
import {
  deleteLabour,
  fetchLabourAttendancesByLabour,
  fetchLabourDetail,
  fetchLabourPaymentsByLabour,
  updateLabour,
} from "../../api/labours.js";
import { fetchSites } from "../../api/sites.js";
import {
  DEFAULT_ATTENDANCE_OPTIONS,
  labourFormSchema,
  labourStatusLabel,
  normalizeLabour,
  toLabourPayload,
} from "../../api/types/labour.js";
import {
  normalizeLabourAttendanceList,
  normalizeLabourPaymentList,
} from "../../api/types/hajira.js";
import { normalizeSiteList } from "../../api/types/site.js";
import { parseApiError, applyFieldErrors } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { formatBnNumber, formatBnSigned } from "../../utils/format.js";
import { PERMS } from "../../utils/permissions.js";
import { paths } from "../../router/paths.js";

const toFormValues = (labour) => ({
  name: labour?.name ?? "",
  current_site: labour?.currentSite != null ? String(labour.currentSite) : "",
  default_attendance: labour?.defaultAttendance ?? 1,
  default_salary: labour?.defaultSalary ?? 0,
  default_fooding: labour?.defaultFooding ?? 0,
  is_active: labour?.isActive ?? true,
});

const formatMetaDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "আজ";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
  }).format(d);
};

const formatShortDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(d);
};

const AccountRow = ({ label, value, dashed = true, strong = false }) => (
  <div
    className={[
      "flex items-center justify-between gap-3 py-2.5 text-sm",
      dashed ? "border-b border-dashed border-base-300" : "",
      strong ? "font-semibold" : "",
    ].join(" ")}
  >
    <span className="text-base-content/80">{label}</span>
    <span className="tabular-nums shrink-0">{value}</span>
  </div>
);

export const LabourDetailPage = () => {
  const { labourId } = useParams();
  const navigate = useNavigate();
  const { setTitle } = useOutletContext();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [apiError, setApiError] = useState(null);

  const canViewLabour = can(PERMS.viewLabour);
  const canChangeLabour = can(PERMS.changeLabour);
  const canDeleteLabour = can(PERMS.deleteLabour);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(labourFormSchema),
    defaultValues: toFormValues(null),
  });

  const detailQuery = useQuery({
    queryKey: ["labours", labourId],
    queryFn: async () => {
      const { data } = await fetchLabourDetail(labourId);
      return normalizeLabour(data);
    },
    enabled: Boolean(canViewLabour && labourId),
  });

  const sitesQuery = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data } = await fetchSites();
      return normalizeSiteList(data);
    },
    enabled: canViewLabour,
  });

  const attendanceQuery = useQuery({
    queryKey: ["labours", labourId, "attendances"],
    queryFn: async () => {
      const { data } = await fetchLabourAttendancesByLabour(labourId);
      return normalizeLabourAttendanceList(data);
    },
    enabled: Boolean(canViewLabour && labourId),
  });

  const paymentQuery = useQuery({
    queryKey: ["labours", labourId, "payments"],
    queryFn: async () => {
      const { data } = await fetchLabourPaymentsByLabour(labourId);
      return normalizeLabourPaymentList(data);
    },
    enabled: Boolean(canViewLabour && labourId),
  });

  const labour = detailQuery.data;
  const nameValue = watch("name");
  const siteValue = watch("current_site");
  const attendanceValue = watch("default_attendance");
  const salaryValue = watch("default_salary");
  const foodingValue = watch("default_fooding");
  const isActiveValue = watch("is_active");

  const siteNameById = useMemo(() => {
    const map = new Map();
    for (const s of sitesQuery.data ?? []) {
      map.set(String(s.id), s.name);
    }
    return map;
  }, [sitesQuery.data]);

  const currentSiteLabel =
    siteNameById.get(String(siteValue || labour?.currentSite || "")) || "—";

  const account = useMemo(() => {
    const attendances = attendanceQuery.data ?? [];
    const payments = paymentQuery.data ?? [];
    let totalWork = 0;
    let totalSalary = 0;
    for (const a of attendances) {
      totalWork += Number(a.present) || 0;
      totalSalary += (Number(a.salary) || 0) + (Number(a.extra) || 0);
    }
    let totalFooding = 0;
    let totalAdvance = 0;
    for (const p of payments) {
      const signed =
        p.type === "return" ? -Math.abs(p.amount) : Math.abs(p.amount);
      if (p.category === "fooding") totalFooding += signed;
      else if (p.category === "advance") totalAdvance += signed;
    }
    const currentBalance = totalSalary - totalFooding - totalAdvance;
    const previousDue = 0;
    return {
      totalWork,
      totalSalary,
      totalFooding,
      totalAdvance,
      currentBalance,
      previousDue,
      grandTotal: currentBalance + previousDue,
    };
  }, [attendanceQuery.data, paymentQuery.data]);

  useEffect(() => {
    setTitle?.(labour?.name || "লেবার বিবরণ");
    return () => setTitle?.("");
  }, [setTitle, labour?.name]);

  useEffect(() => {
    if (labour) reset(toFormValues(labour));
  }, [labour, reset]);

  // Prevent ghost-submit: Update and Confirm share the same spot.
  useEffect(() => {
    if (!editing) {
      setConfirmReady(false);
      return;
    }
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setConfirmReady(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [editing]);

  const mutation = useMutation({
    mutationFn: (values) => updateLabour(labourId, toLabourPayload(values)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLabour(labourId),
  });

  const startEdit = () => {
    setApiError(null);
    setConfirmReady(false);
    setShowDetails(true);
    setEditing(true);
  };

  const cancelEdit = () => {
    setApiError(null);
    reset(toFormValues(labour));
    setEditing(false);
  };

  const onDelete = async () => {
    const ok = window.confirm("এই লেবার মুছে ফেলতে চান?");
    if (!ok) return;
    setApiError(null);
    try {
      await deleteMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ["labours"] });
      navigate(paths.labours, { replace: true });
    } catch (err) {
      setApiError(parseApiError(err));
    }
  };

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { data } = await mutation.mutateAsync(values);
      const normalized = normalizeLabour(data);
      reset(toFormValues(normalized));
      await queryClient.invalidateQueries({ queryKey: ["labours"] });
      setEditing(false);
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      applyFieldErrors(parsed, setError);
    }
  });

  if (!canViewLabour) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (detailQuery.isError) {
    return <ApiErrorAlert error={parseApiError(detailQuery.error)} />;
  }

  if (!labour) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        লেবার পাওয়া যায়নি।
      </div>
    );
  }

  const disabled = !editing;
  const busy = isSubmitting || mutation.isPending;
  const fieldClass = (hasError, kind = "input") =>
    [
      kind === "select"
        ? "select select-sm select-bordered w-full"
        : "input input-sm input-bordered w-full",
      hasError ? (kind === "select" ? "select-error" : "input-error") : "",
    ].join(" ");

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <ApiErrorAlert error={apiError} />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirmReady) return;
          return onConfirm(e);
        }}
        noValidate
      >
        {/* Profile header */}
        <div className="relative flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="size-16 rounded-full bg-base-200 border border-base-300 flex items-center justify-center overflow-hidden">
              <HardHat
                className="size-7 text-base-content/35"
                strokeWidth={1.5}
              />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 badge badge-sm badge-info border-0 whitespace-nowrap">
              {labourStatusLabel(labour)}
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
            {editing ? (
              <input
                type="text"
                className={[
                  "input input-sm input-bordered h-9 w-full font-semibold text-base",
                  errors.name ? "input-error" : "",
                ].join(" ")}
                maxLength={255}
                {...register("name")}
              />
            ) : (
              <h2 className="text-xl font-bold leading-tight truncate text-base-content">
                {nameValue || labour.name}
              </h2>
            )}
            {errors.name ? (
              <p className="text-error text-xs">{errors.name.message}</p>
            ) : null}

            <select
              className={[
                "select select-sm select-bordered w-full",
                disabled ? "bg-base-100" : "",
              ].join(" ")}
              disabled={disabled}
              {...register("current_site")}
            >
              <option value="">সাইট নেই</option>
              {(sitesQuery.data ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>

            <label
              className={[
                "flex items-center gap-2 text-sm",
                disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-success"
                disabled={disabled}
                {...register("is_active")}
              />
            </label>
          </div>

          <button
            type="button"
            className={[
              "btn btn-ghost btn-circle btn-sm shrink-0",
              showDetails ? "text-primary" : "text-primary/70",
            ].join(" ")}
            aria-label="তথ্য"
            aria-expanded={showDetails}
            onClick={() => {
              if (editing) return;
              setShowDetails((v) => !v);
            }}
          >
            <Info className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Info card — opens via info button */}
        {showDetails ? (
          <div className="rounded-xl bg-base-200/80 px-3.5 py-3 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <label className="form-control w-full">
                <span className="label-text text-xs mb-1">ডিফল্ট হাজিরা</span>
                <select
                  className={fieldClass(errors.default_attendance, "select")}
                  disabled={disabled}
                  {...register("default_attendance")}
                >
                  {DEFAULT_ATTENDANCE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {formatBnNumber(v, { maximumFractionDigits: 1 })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control w-full">
                <span className="label-text text-xs mb-1">ডিফল্ট বেতন</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  disabled={disabled}
                  className={fieldClass(errors.default_salary)}
                  {...register("default_salary")}
                />
                {errors.default_salary ? (
                  <span className="label-text-alt text-error mt-1">
                    {errors.default_salary.message}
                  </span>
                ) : null}
              </label>
              <label className="form-control w-full">
                <span className="label-text text-xs mb-1">ডিফল্ট খোরাকি</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  disabled={disabled}
                  className={fieldClass(errors.default_fooding)}
                  {...register("default_fooding")}
                />
                {errors.default_fooding ? (
                  <span className="label-text-alt text-error mt-1">
                    {errors.default_fooding.message}
                  </span>
                ) : null}
              </label>
            </div>

            {canChangeLabour || canDeleteLabour ? (
              editing ? (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm flex-1"
                    onClick={cancelEdit}
                    disabled={busy}
                  >
                    <X className="size-4" strokeWidth={1.75} />
                    বাতিল করুন
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex-1"
                    disabled={!confirmReady || busy}
                    onClick={(e) => {
                      if (!confirmReady) return;
                      return onConfirm(e);
                    }}
                  >
                    {busy ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <Check className="size-4" strokeWidth={2} />
                    )}
                    নিশ্চিত করুন
                  </button>
                </div>
              ) : (
                <div className="flex justify-between gap-2 pt-1">
                  {canDeleteLabour ? (
                    <button
                      type="button"
                      className="btn btn-error btn-sm"
                      onClick={onDelete}
                      disabled={deleteMutation.isPending}
                      aria-label="ডিলিট করুন"
                    >
                      {deleteMutation.isPending ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <>
                          <Trash2 className="size-4" strokeWidth={2} />
                          <span>ডিলিট করুন</span>
                        </>
                      )}
                    </button>
                  ) : null}
                  {canChangeLabour ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={startEdit}
                    >
                      <UserRoundPen className="size-4" strokeWidth={2} />
                      আপডেট করুন
                    </button>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-base-300" />

        {/* Running account */}
        <section className="pt-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-primary">চলমান হিসাব</h3>
            <span
              className="tooltip tooltip-left"
              data-tip="হাজিরা ও পেমেন্ট থেকে হিসাব"
            >
              <CircleHelp
                className="size-4 text-primary opacity-80"
                strokeWidth={1.75}
              />
            </span>
          </div>

          {attendanceQuery.isLoading || paymentQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : (
            <div>
              <AccountRow
                label="মোট কাজ:"
                value={`${formatBnNumber(account.totalWork, {
                  maximumFractionDigits: 1,
                })} দিন`}
              />
              <AccountRow
                label="মোট বেতন:"
                value={formatBnNumber(account.totalSalary)}
              />
              <AccountRow
                label="মোট খোরাকি:"
                value={formatBnSigned(-Math.abs(account.totalFooding), {
                  showPlus: false,
                })}
              />
              <AccountRow
                label="মোট অ্যাডভান্স:"
                value={formatBnSigned(-Math.abs(account.totalAdvance), {
                  showPlus: false,
                })}
                dashed={false}
              />
              <div className="border-t border-base-content/40" />
              <AccountRow
                label="বর্তমান হিসাব:"
                value={formatBnNumber(account.currentBalance)}
                dashed={false}
                strong
              />
              <div className="border-t border-base-content/40" />
              <AccountRow
                label="আগের পাওনা:"
                value={formatBnSigned(account.previousDue)}
              />
              <AccountRow
                label="সর্বমোট হিসাব:"
                value={formatBnNumber(account.grandTotal)}
                dashed={false}
                strong
              />
              <div className="border-t-2 border-base-content/50" />
            </div>
          )}
        </section>
      </form>
    </div>
  );
};
