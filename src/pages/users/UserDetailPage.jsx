import { useEffect, useRef, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { fetchUserDetail, updateUser } from "../../api/users.js";
import {
  buildGroupSelectOptions,
  toSingleGroupNames,
  normalizeSiteIds,
  toUserAdminUpdatePayload,
  userAdminUpdateSchema,
  userStatusLabel,
} from "../../api/types/user.js";
import { parseApiError, applyFieldErrors } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { DetailMenuButton } from "../../layouts/DetailLayout.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { useSitesLookup } from "../../hooks/useSites.js";
import { toastSuccess } from "../../utils/feedback.js";
import { groupLabelBn, PERMS } from "../../utils/permissions.js";

const EDIT_MODAL_ID = "user_edit_modal";

const toFormValues = (user) => ({
  is_active: user?.is_active ?? true,
  groups: toSingleGroupNames(user?.groups),
  sites: normalizeSiteIds(user?.sites),
});

const toggleItem = (list, item) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export const UserDetailPage = () => {
  const { userId } = useParams();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const editDialogRef = useRef(null);
  const [apiError, setApiError] = useState(null);

  const canViewUser = can(PERMS.viewUser);
  const canChangeUser = can(PERMS.changeUser);

  const {
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
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

  const {
    sites: allSites,
    getSiteName,
    isLoading: sitesLoading,
  } = useSitesLookup({
    enabled: canViewUser,
  });

  const user = detailQuery.data;
  const isActiveValue = watch("is_active");
  const groupNames = watch("groups") ?? [];
  const siteIds = watch("sites") ?? [];

  const assignableGroups = buildGroupSelectOptions(user?.groups);

  useEffect(() => {
    setTitle?.("ইউজার বিবরণ");
    return () => setTitle?.("");
  }, [setTitle]);

  useEffect(() => {
    if (user) reset(toFormValues(user));
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: (values) =>
      updateUser(userId, toUserAdminUpdatePayload(values)),
  });

  const openEditModal = () => {
    if (!user || !canChangeUser) return;
    setApiError(null);
    reset(toFormValues(user));
    editDialogRef.current?.showModal();
  };

  const closeEditModal = () => {
    editDialogRef.current?.close();
  };

  const onEditModalClose = () => {
    setApiError(null);
    reset(toFormValues(user));
  };

  const openEditModalRef = useRef(openEditModal);
  openEditModalRef.current = openEditModal;

  useEffect(() => {
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-48 p-1 shadow-md border border-base-300"
        >
          {canChangeUser ? (
            <li>
              <button type="button" onClick={() => openEditModalRef.current()}>
                আপডেট
              </button>
            </li>
          ) : null}
          <li>
            <span className="opacity-50 pointer-events-none">ডিলিট</span>
          </li>
        </ul>
      </DetailMenuButton>,
    );
    return () => setHeaderMenu?.(null);
  }, [setHeaderMenu, canChangeUser]);

  const onConfirmEdit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { data } = await mutation.mutateAsync(values);
      reset(toFormValues(data));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      closeEditModal();
      toastSuccess("ইউজার আপডেট হয়েছে");
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      applyFieldErrors(parsed, setError);
    }
  });

  if (!canViewUser) {
    return (
      <div className="text-sm text-error py-8 text-center px-3">
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
      <div className="text-sm text-base-content/70 py-8 text-center px-3">
        ইউজার পাওয়া যায়নি।
      </div>
    );
  }

  const busy = isSubmitting || mutation.isPending;
  const groups = Array.isArray(user.groups) ? user.groups : [];
  const assignedSiteIds = normalizeSiteIds(user.sites);
  const companyName =
    typeof user.company === "object" ? user.company?.name : user.company;

  return (
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto space-y-4 px-3 py-3">
      <section className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">নাম</span>
          <span className="font-medium text-right">{user.name || "—"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">ফোন নম্বর</span>
          <span className="font-medium text-right tabular-nums">
            {user.phone_number || "—"}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">ইমেইল</span>
          <span className="font-medium text-right">{user.email || "—"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">কোম্পানি</span>
          <span className="font-medium text-right">{companyName || "—"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">স্ট্যাটাস</span>
          <span className="font-medium text-right">
            {userStatusLabel(user)}
          </span>
        </div>
      </section>

      <div className="divider"></div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <span className="label-text mb-1">গ্রুপ</span>
          {groups.length ? (
            <ol className="mt-1 list-decimal space-y-0.5 pl-6 text-sm text-base-content/80">
              {user.is_companyadmin ? <li>কোম্পানি অ্যাডমিন</li> : null}
              {groups.map((g) => (
                <li key={g.id ?? g.name}>{groupLabelBn(g.name ?? g)}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-base-content/55 mt-1">
              কোনো গ্রুপ নির্ধারণ করা হয়নি।
            </p>
          )}
        </div>
        <div className="flex-1">
          <span className="label-text mb-1">দায়িত্বপ্রাপ্ত সাইট</span>
          {assignedSiteIds.length ? (
            <ol className="mt-1 list-decimal space-y-0.5 pl-6 text-sm text-base-content/80">
              {assignedSiteIds.map((id) => (
                <li key={id}>{getSiteName(id)}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-base-content/55 mt-1">
              কোনো সাইট নির্ধারণ করা হয়নি।
            </p>
          )}
        </div>
      </div>

      <dialog
        ref={editDialogRef}
        id={EDIT_MODAL_ID}
        className="modal"
        onClose={onEditModalClose}
      >
        <div className="modal-box max-w-lg max-h-[min(32rem,85vh)] flex flex-col overflow-hidden!">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>

          <h3 className="font-semibold text-base mb-3 pr-8 shrink-0">
            ইউজার আপডেট
          </h3>

          <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

          <form
            className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              return onConfirmEdit(e);
            }}
            noValidate
          >
            <div>
              <span className="label-text font-medium mb-1">গ্রুপ</span>
              <div className="border p-2 border-base-300 flex flex-col gap-1 max-h-32 overflow-y-auto overscroll-contain pr-1">
                {assignableGroups.map((g) => {
                  const checked = groupNames.includes(g.name);
                  return (
                    <label
                      key={g.name}
                      className={[
                        "flex items-center gap-3 py-1.5 cursor-pointer",
                        g.disabled ? "cursor-default opacity-80" : "",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="user-group"
                        className="radio radio-sm radio-primary shrink-0"
                        disabled={g.disabled}
                        checked={checked}
                        onChange={() => {
                          if (g.disabled) return;
                          setValue("groups", [g.name], {
                            shouldDirty: true,
                          });
                        }}
                      />
                      <span className="text-sm leading-snug">{g.label}</span>
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

            <div className="flex flex-col flex-1 min-h-0">
              <span className="label-text font-medium">
                দায়িত্বপ্রাপ্ত সাইট
              </span>
              <div className="border p-2 border-base-300 mt-1 flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
                {sitesLoading ? (
                  <div className="flex justify-center py-3">
                    <span className="loading loading-spinner loading-sm" />
                  </div>
                ) : allSites.length === 0 ? (
                  <p className="text-sm text-base-content/55 py-1">
                    কোনো সাইট নির্ধারণ করা হয়নি।
                  </p>
                ) : (
                  allSites.map((s) => {
                    const id = Number(s.id);
                    const checked = siteIds.includes(id);
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-3 py-1.5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary shrink-0"
                          checked={checked}
                          onChange={() => {
                            setValue("sites", toggleItem(siteIds, id), {
                              shouldDirty: true,
                            });
                          }}
                        />
                        <span className="text-sm leading-snug truncate min-w-0">
                          {getSiteName(id)}
                        </span>
                        {s.is_closed ? (
                          <span className="badge badge-ghost badge-xs shrink-0">
                            কমপ্লিট
                          </span>
                        ) : null}
                      </label>
                    );
                  })
                )}
              </div>
              {errors.sites ? (
                <span className="label-text-alt text-error mt-1 shrink-0">
                  {errors.sites.message}
                </span>
              ) : null}
            </div>

            <label className="label cursor-pointer justify-start gap-3 py-2 shrink-0">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={Boolean(isActiveValue)}
                onChange={(e) =>
                  setValue("is_active", e.target.checked, { shouldDirty: true })
                }
              />
              <span className="label-text">চালু</span>
            </label>

            <div className="mt-2 shrink-0">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!isDirty || busy || sitesLoading}
              >
                {busy ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                নিশ্চিত
              </button>
            </div>
          </form>
        </div>
        <div className="modal-backdrop">
          <button type="button" tabIndex={-1} aria-hidden="true" />
        </div>
      </dialog>
    </div>
  );
};
