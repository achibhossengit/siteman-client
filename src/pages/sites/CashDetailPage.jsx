import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteSiteCash,
  fetchBillingCategories,
  fetchSiteCashDetail,
  updateSiteCash,
} from "../../api/sites.js";
import {
  CASH_CATEGORIES,
  CASH_TYPES,
  cashFormSchema,
  toSiteCashPayload,
} from "../../api/types/siteCash.js";
import { parseApiError, applyFieldErrors } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { useAuth } from "../../providers/AuthProvider.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { PERMS } from "../../utils/permissions.js";
import { paths } from "../../router/paths.js";
import { readSelectedSite } from "../../utils/sessionSelection.js";

const toFormValues = (cash) => ({
  note: cash?.note ?? "",
  type: cash?.type ?? "cost",
  amount: cash?.amount ?? "",
  category: cash?.category ?? "",
  billing: cash?.billing != null ? String(cash.billing) : "",
});

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
};

export const CashDetailPage = () => {
  const { cashId } = useParams();
  const navigate = useNavigate();
  const { setTitle } = useOutletContext();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const siteId = readSelectedSite();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [apiError, setApiError] = useState(null);

  const canViewCash = can(PERMS.viewSiteCash);
  const canChangeCash = can(PERMS.changeSiteCash);
  const canDeleteCash = can(PERMS.deleteSiteCash);

  const site = (profile?.sites ?? []).find(
    (s) => String(s.id) === String(siteId),
  );
  const siteInactive = site?.is_active === false;

  useEffect(() => {
    setTitle?.("ক্যাশ বিবরণ");
    return () => setTitle?.("");
  }, [setTitle]);

  // Prevent ghost-submit: Update and Confirm share the same spot; the same
  // click must not activate the newly mounted submit button.
  useEffect(() => {
    if (!editing) {
      setConfirmReady(false);
      return;
    }
    setConfirmReady(true);
  }, [editing]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(cashFormSchema),
    defaultValues: toFormValues(null),
  });

  const type = watch("type");
  const categoryEnabled = type === "cost";

  useEffect(() => {
    if (!categoryEnabled) setValue("category", "");
  }, [categoryEnabled, setValue]);

  const detailQuery = useQuery({
    queryKey: ["sites", siteId, "cash", cashId],
    queryFn: async () => {
      const { data } = await fetchSiteCashDetail(siteId, cashId);
      return data;
    },
    enabled: Boolean(canViewCash && siteId && cashId),
  });

  const billingQuery = useQuery({
    queryKey: ["sites", siteId, "billing-categories"],
    queryFn: async () => {
      const { data } = await fetchBillingCategories(siteId, {
        is_active: true,
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(canViewCash && siteId),
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      updateSiteCash(
        siteId,
        cashId,
        toSiteCashPayload({ ...values, date: detailQuery.data?.date }),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSiteCash(siteId, cashId),
  });

  useEffect(() => {
    if (detailQuery.data) reset(toFormValues(detailQuery.data));
  }, [detailQuery.data, reset]);

  const startEdit = () => {
    setApiError(null);
    setConfirmReady(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setApiError(null);
    reset(toFormValues(detailQuery.data));
    setEditing(false);
  };

  const onDelete = async () => {
    const ok = window.confirm("এই ক্যাশ এন্ট্রি মুছে ফেলতে চান?");
    if (!ok) return;
    setApiError(null);
    try {
      await deleteMutation.mutateAsync();
      await queryClient.invalidateQueries({
        queryKey: ["sites", siteId, "cash"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sites", siteId, "daily-reports"],
      });
      navigate(paths.cash, { replace: true });
    } catch (err) {
      setApiError(parseApiError(err));
    }
  };

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { data } = await mutation.mutateAsync(values);
      reset(toFormValues(data));
      await queryClient.invalidateQueries({
        queryKey: ["sites", siteId, "cash"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sites", siteId, "daily-reports"],
      });
      setEditing(false);
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      applyFieldErrors(parsed, setError);
    }
  });

  if (!canViewCash) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    );
  }

  if (!siteId) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        ক্যাশ দেখতে আগে একটি সাইট নির্বাচন করুন।
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

  const cash = detailQuery.data;
  const disabled = !editing;
  const fieldClass = (hasError, kind = "input") =>
    [
      kind === "select"
        ? "select select-bordered w-full"
        : "input input-bordered w-full",
      hasError ? (kind === "select" ? "select-error" : "input-error") : "",
      disabled ? "bg-base-200" : "",
    ].join(" ");

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          if (!confirmReady) {
            e.preventDefault();
            return;
          }
          return onConfirm(e);
        }}
        noValidate
      >
        <label className="form-control w-full">
          <span className="label-text mb-1">বিবরণ</span>
          <input
            type="text"
            className={fieldClass(errors.note)}
            maxLength={255}
            disabled={disabled}
            {...register("note")}
          />
          {errors.note ? (
            <span className="label-text-alt text-error mt-1">
              {errors.note.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">পরিমাণ</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className={fieldClass(errors.amount)}
            disabled={disabled}
            {...register("amount")}
          />
          {errors.amount ? (
            <span className="label-text-alt text-error mt-1">
              {errors.amount.message}
            </span>
          ) : null}
        </label>

        <div className="flex justify-between gap-2">
          <label className="form-control w-full">
            <span className="label-text mb-1">ধরন</span>
            <select
              className={fieldClass(errors.type, "select")}
              disabled={disabled}
              {...register("type")}
            >
              {CASH_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.type ? (
              <span className="label-text-alt text-error mt-1">
                {errors.type.message}
              </span>
            ) : null}
          </label>

          <label className="form-control w-full">
            <span className="label-text mb-1">ক্যাটাগরি</span>
            <select
              className={fieldClass(errors.category, "select")}
              disabled={disabled || !categoryEnabled}
              {...register("category")}
            >
              <option value="">—</option>
              {CASH_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-control w-full">
          <span className="label-text mb-1">বিলিং ক্যাটাগরি</span>
          <select
            className={fieldClass(errors.billing, "select")}
            disabled={disabled}
            {...register("billing")}
          >
            <option value="">—</option>
            {(billingQuery.data ?? []).map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm pt-1">
          <div>
            <span className="text-base-content/60">তৈরি:</span>{" "}
            <span className="tabular-nums">
              {formatDateTime(cash?.created_at)}
            </span>
          </div>
          <div>
            <span className="text-base-content/60">আপডেট:</span>{" "}
            <span className="tabular-nums">
              {formatDateTime(cash?.updated_at)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelEdit}
                disabled={isSubmitting || mutation.isPending}
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!confirmReady || isSubmitting || mutation.isPending}
              >
                {isSubmitting || mutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "নিশ্চিত"
                )}
              </button>
            </>
          ) : (
            <>
              {canDeleteCash ? (
                <button
                  type="button"
                  className="btn btn-error btn-outline"
                  onClick={onDelete}
                  disabled={siteInactive || deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "ডিলিট করুন"
                  )}
                </button>
              ) : null}
              {canChangeCash ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={startEdit}
                  disabled={siteInactive}
                >
                  আপডেট করুন
                </button>
              ) : null}
            </>
          )}
        </div>
      </form>
    </div>
  );
};
