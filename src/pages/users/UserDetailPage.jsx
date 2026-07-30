import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";
import { fetchUserDetail, updateUser } from "../../api/users.js";
import { fetchSites } from "../../api/sites.js";
import {
  buildAssignableGroups,
  normalizeGroupNames,
  normalizeSiteIds,
  toUserAdminUpdatePayload,
  userAdminUpdateSchema,
} from "../../api/types/user.js";
import { parseApiError, applyFieldErrors } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { DetailMenuButton } from "../../layouts/DetailLayout.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { toastSuccess } from "../../utils/feedback.js";
import { PERMS } from "../../utils/permissions.js";

const toFormValues = (user) => ({
  is_active: user?.is_active ?? true,
  groups: normalizeGroupNames(user?.groups),
  sites: normalizeSiteIds(user?.sites),
});

const toggleItem = (list, item) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export const UserDetailPage = () => {
  const { userId } = useParams();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [apiError, setApiError] = useState(null);

  const canViewUser = can(PERMS.viewUser);
  const canChangeUser = can(PERMS.changeUser);

  const {
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(userAdminUpdateSchema),
    defaultValues: toFormValues(null),
  });

  const detailQuery = useQuery({
    queryKey: ["users", userId],
    queryFn: async () => {
      const { data } = await fetchUserDetail(userId);
      return data;
    },
    enabled: Boolean(canViewUser && userId),
  });

  // Fetch all sites only when entering edit mode.
  const sitesQuery = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data } = await fetchSites();
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(canViewUser && editing),
  });

  const user = detailQuery.data;
  const isActiveValue = watch("is_active");
  const groupNames = watch("groups") ?? [];
  const siteIds = watch("sites") ?? [];

  const assignableGroups = buildAssignableGroups();

  useEffect(() => {
    setTitle?.("ইউজার বিবরণ");
    return () => setTitle?.("");
  }, [setTitle]);

  useEffect(() => {
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-48 p-1 shadow-md border border-base-300"
        >
          <li>
            <span className="opacity-50 pointer-events-none">ডিলিট</span>
          </li>
        </ul>
      </DetailMenuButton>,
    );
    return () => setHeaderMenu?.(null);
  }, [setHeaderMenu]);

  useEffect(() => {
    if (user) reset(toFormValues(user));
  }, [user, reset]);

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
    mutationFn: (values) =>
      updateUser(userId, toUserAdminUpdatePayload(values)),
  });

  const startEdit = () => {
    setApiError(null);
    setConfirmReady(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setApiError(null);
    reset(toFormValues(user));
    setEditing(false);
  };

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { data } = await mutation.mutateAsync(values);
      reset(toFormValues(data));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditing(false);
      toastSuccess("ইউজার আপডেট হয়েছে");
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      applyFieldErrors(parsed, setError);
    }
  });

  if (!canViewUser) {
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

  if (!user) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        ইউজার পাওয়া যায়নি।
      </div>
    );
  }

  const disabled = !editing;
  const busy = isSubmitting || mutation.isPending;
  const assignedSites = Array.isArray(user.sites) ? user.sites : [];
  const siteOptions = editing ? (sitesQuery.data ?? []) : assignedSites;

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirmReady) return;
          return onConfirm(e);
        }}
        noValidate
      >
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-baseline gap-2 justify-between">
            <span className="text-sm">নাম</span>
            <span className="text-sm font-medium truncate">
              {user.name || "—"}
            </span>
          </div>
          <div className="flex items-baseline gap-2 justify-between">
            <span className="text-sm">ফোন নম্বর</span>
            <span className="text-sm font-medium truncate tabular-nums">
              {user.phone_number || "—"}
            </span>
          </div>
          <div className="flex items-baseline gap-2 justify-between">
            <span className="text-sm">ইমেইল</span>
            <span className="text-sm font-medium truncate">
              {user.email || "—"}
            </span>
          </div>
        </div>

        <div className="rounded-box border border-base-300 bg-base-100 overflow-hidden">
          <div className="p-3 border-b border-base-300">
            <span className="label-text font-medium">গ্রুপ</span>
            <div className="mt-2 flex flex-col gap-1.5 h-24 overflow-y-auto pr-1">
              {assignableGroups.map((g) => {
                const checked = groupNames.includes(g.name);
                return (
                  <label
                    key={g.name}
                    className={[
                      "label cursor-pointer justify-start gap-3 py-1 min-h-0",
                      disabled ? "cursor-default opacity-80" : "",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      disabled={disabled}
                      checked={checked}
                      onChange={() => {
                        if (disabled) return;
                        setValue("groups", toggleItem(groupNames, g.name), {
                          shouldDirty: true,
                        });
                      }}
                    />
                    <span className="label-text">{g.label}</span>
                  </label>
                );
              })}
            </div>
            {errors.groups ? (
              <span className="label-text-alt text-error mt-1">
                {errors.groups.message}
              </span>
            ) : null}
          </div>

          <div className="p-3">
            <span className="label-text font-medium">দায়িত্বপ্রাপ্ত সাইট</span>
            <div className="mt-2 flex flex-col gap-1.5 h-24 overflow-y-auto pr-1">
              {editing && sitesQuery.isLoading ? (
                <div className="flex justify-center py-3">
                  <span className="loading loading-spinner loading-sm" />
                </div>
              ) : siteOptions.length === 0 ? (
                <p className="text-sm text-base-content/55 py-1">
                  কোনো সাইট নির্ধারণ করা হয়নি।
                </p>
              ) : (
                siteOptions.map((s) => {
                  const id = Number(s.id);
                  const checked = siteIds.includes(id);
                  return (
                    <label
                      key={id}
                      className={[
                        "label cursor-pointer justify-start gap-3 py-1 min-h-0",
                        disabled ? "cursor-default opacity-80" : "",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        disabled={disabled}
                        checked={checked}
                        onChange={() => {
                          if (disabled) return;
                          setValue("sites", toggleItem(siteIds, id), {
                            shouldDirty: true,
                          });
                        }}
                      />
                      <span className="label-text truncate">
                        {typeof s === "object" ? s.name : `সাইট #${s}`}
                      </span>
                      {s.is_closed ? (
                        <span className="badge badge-ghost badge-xs">বন্ধ</span>
                      ) : null}
                    </label>
                  );
                })
              )}
            </div>
            {errors.sites ? (
              <span className="label-text-alt text-error mt-1">
                {errors.sites.message}
              </span>
            ) : null}
          </div>
        </div>

        <label
          className={[
            "label justify-start gap-3 py-2",
            disabled ? "cursor-default" : "cursor-pointer",
          ].join(" ")}
        >
          <input
            type="checkbox"
            className="toggle toggle-primary"
            disabled={disabled}
            checked={Boolean(isActiveValue)}
            onChange={(e) =>
              setValue("is_active", e.target.checked, { shouldDirty: true })
            }
          />
          <span className="label-text">সক্রিয়</span>
        </label>

        {canChangeUser ? (
          editing ? (
            <div className="flex gap-2 mt-1">
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
                disabled={!confirmReady || busy || sitesQuery.isLoading}
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
            <button
              type="button"
              className="btn btn-outline btn-primary w-full mt-1"
              onClick={startEdit}
            >
              <Pencil className="size-4" strokeWidth={1.75} />
              আপডেট
            </button>
          )
        ) : null}
      </form>
    </div>
  );
};
