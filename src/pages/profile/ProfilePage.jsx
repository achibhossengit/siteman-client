import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useAuth } from "../../providers/AuthProvider.jsx";
import { updateProfile } from "../../api/profile.js";
import {
  profileUpdateSchema,
  passwordCreateSchema,
  toProfileUpdatePayload,
  profileAllowedGroups,
  profileAllowedSiteIds,
} from "../../api/types/user.js";
import { parseApiError, applyFieldErrors } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { DetailMenuButton } from "../../layouts/DetailLayout.jsx";
import { useSitesLookup } from "../../hooks/useSites.js";
import { toastSuccess } from "../../utils/feedback.js";
import { groupLabelBn } from "../../utils/permissions.js";

const EDIT_MODAL_ID = "profile_edit_modal";
const PASSWORD_MODAL_ID = "profile_change_password_modal";

const toFormValues = (profile) => ({
  name: profile?.name ?? "",
  phone_number: profile?.phone_number ?? "",
  email: profile?.email ?? "",
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "বর্তমান পাসওয়ার্ড দিন"),
    new_password: passwordCreateSchema,
    confirm_password: z.string().min(1, "পাসওয়ার্ড নিশ্চিত করুন"),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "পাসওয়ার্ড মিলছে না",
    path: ["confirm_password"],
  });

const emptyPasswordValues = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export const ProfilePage = () => {
  const { setTitle, setHeaderMenu } = useOutletContext();
  const { profile, setProfile, bootstrapProfile, changePassword } = useAuth();
  const { getSiteName } = useSitesLookup();
  const editDialogRef = useRef(null);
  const passwordDialogRef = useRef(null);

  const [apiError, setApiError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: toFormValues(null),
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    setError: setPasswordFieldError,
    watch: watchPassword,
    formState: { errors: passwordErrors, isSubmitting: passwordSubmitting },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: emptyPasswordValues,
    mode: "onChange",
  });

  const passwordValues = watchPassword();
  const passwordReady = passwordSchema.safeParse(passwordValues).success;

  useEffect(() => {
    setTitle?.("প্রোফাইল");
    return () => setTitle?.("");
  }, [setTitle]);

  useEffect(() => {
    if (profile) reset(toFormValues(profile));
  }, [profile, reset]);

  const openEditModal = () => {
    if (!profile) return;
    setApiError(null);
    reset(toFormValues(profile));
    editDialogRef.current?.showModal();
  };

  const closeEditModal = () => {
    editDialogRef.current?.close();
  };

  const onEditModalClose = () => {
    setApiError(null);
    reset(toFormValues(profile));
  };

  const openPasswordModal = () => {
    setPasswordError(null);
    resetPassword(emptyPasswordValues);
    passwordDialogRef.current?.showModal();
  };

  const closePasswordModal = () => {
    passwordDialogRef.current?.close();
  };

  const resetPasswordModalState = () => {
    setPasswordError(null);
    resetPassword(emptyPasswordValues);
  };

  const openEditModalRef = useRef(openEditModal);
  openEditModalRef.current = openEditModal;
  const openPasswordModalRef = useRef(openPasswordModal);
  openPasswordModalRef.current = openPasswordModal;

  useEffect(() => {
    setHeaderMenu?.(
      <DetailMenuButton>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-20 w-48 p-1 shadow-md border border-base-300"
        >
          <li>
            <button
              type="button"
              onClick={() => openEditModalRef.current()}
            >
              আপডেট
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => openPasswordModalRef.current()}
            >
              পাসওয়ার্ড পরিবর্তন
            </button>
          </li>
        </ul>
      </DetailMenuButton>,
    );
    return () => setHeaderMenu?.(null);
  }, [setHeaderMenu]);

  const onConfirmEdit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { data } = await updateProfile(toProfileUpdatePayload(values));
      setProfile(data);
      reset(toFormValues(data));
      closeEditModal();
      toastSuccess("প্রোফাইল আপডেট হয়েছে");
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      applyFieldErrors(parsed, setError);
      try {
        await bootstrapProfile();
      } catch {
        // ignore
      }
    }
  });

  const onPasswordConfirm = handlePasswordSubmit(async (values) => {
    setPasswordError(null);
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      closePasswordModal();
      toastSuccess("পাসওয়ার্ড আপডেট হয়েছে");
    } catch (err) {
      const parsed = parseApiError(err);
      setPasswordError(parsed);
      applyFieldErrors(parsed, setPasswordFieldError);
    }
  });

  if (!profile) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const busy = isSubmitting;
  const fieldClass = (hasError) =>
    ["input input-bordered w-full", hasError ? "input-error" : ""].join(" ");

  const groups = profileAllowedGroups(profile);
  const siteIds = profileAllowedSiteIds(profile);
  const companyName =
    typeof profile.company === "object"
      ? profile.company?.name
      : profile.company;

  return (
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto space-y-4 px-3 py-3">
      <section className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">নাম</span>
          <span className="font-medium text-right">{profile.name || "—"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">ফোন নম্বর</span>
          <span className="font-medium text-right tabular-nums">
            {profile.phone_number || "—"}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">ইমেইল</span>
          <span className="font-medium text-right">{profile.email || "—"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-base-content/70">কোম্পানি</span>
          <span className="font-medium text-right">{companyName || "—"}</span>
        </div>
      </section>

      <div className="divider"></div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <span className="label-text mb-1">গ্রুপ</span>
          {profile.is_companyadmin || groups.length ? (
            <ol className="mt-1 list-decimal space-y-0.5 pl-6 text-sm text-base-content/80">
              {profile.is_companyadmin ? (
                <li>কোম্পানি অ্যাডমিন</li>
              ) : null}
              {groups.map((g) => {
                const name = typeof g === "string" ? g : g?.name
                const key =
                  typeof g === "object" && g != null ? (g.id ?? g.name) : g
                return <li key={key}>{groupLabelBn(name)}</li>
              })}
            </ol>
          ) : (
            <p className="text-sm text-base-content/55 mt-1">
              কোনো গ্রুপ নির্ধারণ করা হয়নি।
            </p>
          )}
        </div>
        <div className="flex-1">
          <span className="label-text mb-1">দায়িত্বপ্রাপ্ত সাইট</span>
          {siteIds.length ? (
            <ol className="mt-1 list-decimal space-y-0.5 pl-6 text-sm text-base-content/80">
              {siteIds.map((id) => (
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
        <div className="modal-box max-w-lg max-h-[min(32rem,85vh)] flex flex-col">
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
            প্রোফাইল আপডেট
          </h3>

          <ApiErrorAlert error={apiError} className="mb-3 shrink-0" />

          <form
            className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault();
              return onConfirmEdit(e);
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">নাম</span>
              <input
                type="text"
                className={fieldClass(errors.name)}
                maxLength={255}
                {...register("name")}
              />
              {errors.name ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.name.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">ফোন নম্বর</span>
              <input
                type="tel"
                className={fieldClass(errors.phone_number)}
                maxLength={14}
                {...register("phone_number")}
              />
              {errors.phone_number ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.phone_number.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">ইমেইল</span>
              <input
                type="email"
                className={fieldClass(errors.email)}
                maxLength={254}
                {...register("email")}
              />
              {errors.email ? (
                <span className="label-text-alt text-error mt-1">
                  {errors.email.message}
                </span>
              ) : null}
            </label>

            <div className="mt-2">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!isDirty || busy}
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

      <dialog
        ref={passwordDialogRef}
        id={PASSWORD_MODAL_ID}
        className="modal"
        onClose={resetPasswordModalState}
      >
        <div className="modal-box max-w-sm max-h-[min(32rem,85vh)] flex flex-col">
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
            পাসওয়ার্ড পরিবর্তন
          </h3>

          <ApiErrorAlert error={passwordError} className="mb-3 shrink-0" />

          <form
            className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault();
              return onPasswordConfirm(e);
            }}
            noValidate
          >
            <label className="form-control w-full">
              <span className="label-text mb-1">বর্তমান পাসওয়ার্ড</span>
              <input
                type="password"
                autoComplete="current-password"
                className={`input input-bordered w-full ${passwordErrors.current_password ? "input-error" : ""}`}
                {...registerPassword("current_password")}
              />
              {passwordErrors.current_password ? (
                <span className="label-text-alt text-error mt-1">
                  {passwordErrors.current_password.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">নতুন পাসওয়ার্ড</span>
              <input
                type="password"
                autoComplete="new-password"
                className={`input input-bordered w-full ${passwordErrors.new_password ? "input-error" : ""}`}
                {...registerPassword("new_password")}
              />
              {passwordErrors.new_password ? (
                <span className="label-text-alt text-error mt-1">
                  {passwordErrors.new_password.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">নতুন পাসওয়ার্ড (আবার)</span>
              <input
                type="password"
                autoComplete="new-password"
                className={`input input-bordered w-full ${passwordErrors.confirm_password ? "input-error" : ""}`}
                {...registerPassword("confirm_password")}
              />
              {passwordErrors.confirm_password ? (
                <span className="label-text-alt text-error mt-1">
                  {passwordErrors.confirm_password.message}
                </span>
              ) : null}
            </label>

            <div className="modal-action mt-2">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!passwordReady || passwordSubmitting}
              >
                {passwordSubmitting ? (
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
