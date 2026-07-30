import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, KeyRound, Pencil, X } from "lucide-react";
import { useAuth } from "../../providers/AuthProvider.jsx";
import { updateProfile } from "../../api/profile.js";
import {
  profileUpdateSchema,
  toProfileUpdatePayload,
} from "../../api/types/user.js";
import { parseApiError, applyFieldErrors } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { DetailMenuButton } from "../../layouts/DetailLayout.jsx";
import { paths } from "../../router/paths.js";

const toFormValues = (profile) => ({
  name: profile?.name ?? "",
  phone_number: profile?.phone_number ?? "",
  email: profile?.email ?? "",
});

export const ProfilePage = () => {
  const { setTitle, setHeaderMenu } = useOutletContext();
  const { profile, setProfile, bootstrapProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [confirmReady, setConfirmReady] = useState(false);
  const [apiError, setApiError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: toFormValues(null),
  });

  useEffect(() => {
    setTitle?.("প্রোফাইল");
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
            <Link to={paths.changePassword}>
              <KeyRound className="size-4" strokeWidth={1.75} />
              পাসওয়ার্ড বদলান
            </Link>
          </li>
        </ul>
      </DetailMenuButton>,
    );
    return () => setHeaderMenu?.(null);
  }, [setHeaderMenu]);

  useEffect(() => {
    if (profile) reset(toFormValues(profile));
  }, [profile, reset]);

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

  const startEdit = () => {
    setApiError(null);
    setConfirmReady(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setApiError(null);
    reset(toFormValues(profile));
    setEditing(false);
  };

  const onConfirm = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { data } = await updateProfile(toProfileUpdatePayload(values));
      setProfile(data);
      reset(toFormValues(data));
      setEditing(false);
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

  if (!profile) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const disabled = !editing;
  const busy = isSubmitting;
  const fieldClass = (hasError) =>
    [
      "input input-bordered w-full",
      hasError ? "input-error" : "",
      disabled ? "bg-base-100" : "",
    ].join(" ");

  const groups = Array.isArray(profile.groups) ? profile.groups : [];
  const sites = Array.isArray(profile.sites) ? profile.sites : [];
  const companyName =
    typeof profile.company === "object"
      ? profile.company?.name
      : profile.company;

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

        <label className="form-control w-full">
          <span className="label-text mb-1">ফোন নম্বর</span>
          <input
            type="tel"
            className={fieldClass(errors.phone_number)}
            maxLength={14}
            disabled={disabled}
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
            disabled={disabled}
            {...register("email")}
          />
          {errors.email ? (
            <span className="label-text-alt text-error mt-1">
              {errors.email.message}
            </span>
          ) : null}
        </label>

        {editing ? (
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
            <button
              type="button"
              className="btn btn-outline btn-primary flex-1"
              onClick={startEdit}
            >
              <Pencil className="size-4" strokeWidth={1.75} />
              আপডেট
            </button>
          </div>
        )}
      </form>

      <div className="divider"></div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <span className="label-text mb-1">কোম্পানি</span>
          {companyName ? (
            <p className="text-sm text-base-content/55 mt-1">{companyName}</p>
          ) : null}
        </div>
        <div className="flex-1">
          <span className="label-text mb-1">গ্রুপ</span>
          {groups.length ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profile.is_companyadmin ? (
                <span className="badge badge-secondary badge-sm ml-1">
                  কোম্পানি অ্যাডমিন
                </span>
              ) : null}
              {groups.map((g) => (
                <span key={g.id ?? g.name} className="badge badge-outline">
                  {g.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-base-content/55 mt-1">
              কোনো গ্রুপ নির্ধারণ করা হয়নি।
            </p>
          )}
        </div>
        <div className="flex-1">
          <span className="label-text mb-1">দায়িত্বপ্রাপ্ত সাইট</span>
          {sites.length ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {sites.map((s) => (
                <span key={s.id ?? s} className="badge badge-outline">
                  {s?.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-base-content/55 mt-1">
              কোনো সাইট নির্ধারণ করা হয়নি।
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
