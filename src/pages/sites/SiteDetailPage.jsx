import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { deleteSite, fetchSiteDetail, updateSite } from "../../api/sites.js";
import {
  siteFormSchema,
  toSitePayload,
} from "../../api/types/site.js";
import { parseApiError, applyFieldErrors } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { DetailMenuButton } from "../../layouts/DetailLayout.jsx";
import { useAuth } from "../../providers/AuthProvider.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { PERMS } from "../../utils/permissions.js";
import { confirmAction, toastSuccess } from "../../utils/feedback.js";
import { paths } from "../../router/paths.js";

const toFormValues = (site) => ({
  name: site?.name ?? "",
  is_active: site?.is_active ?? true,
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

export const SiteDetailPage = () => {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const queryClient = useQueryClient();
  const { bootstrapProfile } = useAuth();
  const { can } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [apiError, setApiError] = useState(null);

  const canViewSite = can(PERMS.viewSite);
  const canChangeSite = can(PERMS.changeSite);
  const canDeleteSite = can(PERMS.deleteSite);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(siteFormSchema),
    defaultValues: toFormValues(null),
  });

  const detailQuery = useQuery({
    queryKey: ["sites", siteId],
    queryFn: async () => {
      const { data } = await fetchSiteDetail(siteId);
      return data;
    },
    enabled: Boolean(canViewSite && siteId),
  });

  const site = detailQuery.data;

  setTitle?.("সাইট বিবরণ");

  useEffect(() => {
    if (!siteId) {
      setHeaderMenu?.(null);
      return () => setHeaderMenu?.(null);
    }
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-52 p-1 shadow-md border border-base-300"
        >
          <li>
            <button
              type="button"
              onClick={() => navigate(paths.siteBilling(siteId))}
            >
              বিলিং ক্যাটাগরি
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => navigate(paths.sitePrivateCash(siteId))}
            >
              প্রাইভেট হিসাব
            </button>
          </li>
        </ul>
      </DetailMenuButton>,
    );
    return () => setHeaderMenu?.(null);
  }, [siteId, navigate, setHeaderMenu]);

  useEffect(() => {
    if (site) reset(toFormValues(site));
  }, [site, reset]);

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
    mutationFn: (values) => updateSite(siteId, toSitePayload(values)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSite(siteId),
  });

  const startEdit = () => {
    if (site?.is_closed) return;
    setApiError(null);
    setConfirmReady(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setApiError(null);
    reset(toFormValues(site));
    setEditing(false);
  };

  const onDelete = async () => {
    const ok = await confirmAction({
      title: "সাইট মুছে ফেলবেন?",
      text: "এই কাজটি ফিরিয়ে আনা যাবে না।",
      confirmText: "ডিলিট করুন",
      danger: true,
    });
    if (!ok) return;
    setApiError(null);
    try {
      await deleteMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      try {
        await bootstrapProfile();
      } catch {
        // ignore
      }
      toastSuccess("সাইট ডিলিট হয়েছে");
      navigate(paths.sites, { replace: true });
    } catch (err) {
      setApiError(parseApiError(err));
    }
  };

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { data } = await mutation.mutateAsync(values);
      reset(toFormValues(data));
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      try {
        await bootstrapProfile();
      } catch {
        // ignore
      }
      setEditing(false);
      toastSuccess("সাইট আপডেট হয়েছে");
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      applyFieldErrors(parsed, setError);
    }
  });

  if (!canViewSite) {
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

  if (!site) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        সাইট পাওয়া যায়নি।
      </div>
    );
  }

  const disabled = !editing || site.is_closed;
  const busy = isSubmitting || mutation.isPending;
  const showActions = !site.is_closed || canDeleteSite;
  const fieldClass = (hasError) =>
    [
      "input input-bordered w-full",
      hasError ? "input-error" : "",
      disabled ? "bg-base-100" : "",
    ].join(" ");

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      {site.is_closed ? (
        <div className="alert alert-warning text-sm py-2 mb-3">
          এই সাইট বন্ধ — পরিবর্তন করা যাবে না।
        </div>
      ) : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirmReady) return;
          return onConfirm(e);
        }}
        noValidate
      >
        <label className="form-control w-full">
          <span className="label-text mb-1">নাম</span>
          <input
            type="text"
            className={fieldClass(errors.name)}
            maxLength={255}
            disabled={disabled}
            {...register("name")}
          />
          {errors.name ? (
            <span className="label-text-alt text-error mt-1">
              {errors.name.message}
            </span>
          ) : null}
        </label>

        <label className="label cursor-pointer justify-start gap-3 py-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            disabled={disabled}
            {...register("is_active")}
          />
          <span className="label-text">সক্রিয়</span>
        </label>

        <p className="text-xs text-base-content/55 tabular-nums">
          তৈরি {formatMetaDate(site.created_at)}
          <span className="mx-1.5 opacity-60">·</span>
          আপডেট {formatMetaDate(site.updated_at)}
          {site.closed_at ? (
            <>
              <span className="mx-1.5 opacity-60">·</span>
              বন্ধ {formatMetaDate(site.closed_at)}
            </>
          ) : null}
        </p>

        {showActions ? (
          editing ? (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={cancelEdit}
                disabled={busy}
              >
                <X className="size-4" strokeWidth={1.75} />
                বাতিল করুন
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={!confirmReady || busy}
                onClick={(e) => {
                  if (!confirmReady) return;
                  return onConfirm(e);
                }}
              >
                {busy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Check className="size-4" strokeWidth={2} />
                )}
                নিশ্চিত করুন
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-2">
              {canDeleteSite ? (
                <button
                  type="button"
                  className="btn btn-outline btn-error flex-1"
                  onClick={onDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  )}
                  ডিলিট
                </button>
              ) : null}
              {canChangeSite && !site.is_closed ? (
                <button
                  type="button"
                  className="btn btn-outline btn-primary flex-1"
                  onClick={startEdit}
                >
                  <Pencil className="size-4" strokeWidth={1.75} />
                  আপডেট
                </button>
              ) : null}
            </div>
          )
        ) : null}
      </form>
    </div>
  );
};
