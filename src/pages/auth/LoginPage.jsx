import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../providers/AuthProvider.jsx";
import { parseApiError, applyFieldErrors } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { toastSuccess } from "../../utils/feedback.js";
import { paths } from "../../router/paths.js";

const schema = z.object({
  phone_number: z.string().min(8, "ফোন নম্বর দিন"),
  password: z.string().min(1, "পাসওয়ার্ড দিন"),
});

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState(null);

  const successBanner = location.state?.registered
    ? "নিবন্ধন সম্পন্ন — এখন লগইন করুন"
    : location.state?.passwordReset
      ? "পাসওয়ার্ড আপডেট হয়েছে — এখন লগইন করুন"
      : null;

  useEffect(() => {
    if (!successBanner) return;
    toastSuccess(successBanner, { id: `login-success:${successBanner}` });
  }, [successBanner]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { phone_number: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await login(values);
      navigate(paths.home, { replace: true });
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      applyFieldErrors(parsed, setError);
    }
  });

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <form className="card-body gap-3" onSubmit={onSubmit} noValidate>
        <h1 className="card-title justify-center text-2xl">লগইন</h1>
        <p className="text-center text-sm text-base-content/70 -mt-1">
           ফোন নম্বর ও পাসওয়ার্ড দিয়ে প্রবেশ করুন
        </p>

        <ApiErrorAlert error={apiError} />

        <label className="form-control w-full">
          <span className="label-text mb-1">ফোন নম্বর</span>
          <input
            type="tel"
            autoComplete="username"
            className={`input input-bordered w-full ${errors.phone_number ? "input-error" : ""}`}
            placeholder="+8801..."
            {...register("phone_number")}
          />
          {errors.phone_number ? (
            <span className="label-text-alt text-error mt-1">
              {errors.phone_number.message}
            </span>
          ) : null}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">পাসওয়ার্ড</span>
          <input
            type="password"
            autoComplete="current-password"
            className={`input input-bordered w-full ${errors.password ? "input-error" : ""}`}
            {...register("password")}
          />
          {errors.password ? (
            <span className="label-text-alt text-error mt-1">
              {errors.password.message}
            </span>
          ) : null}
        </label>
        <Link to={paths.passwordReset} className="link link-hover text-base-content/70">
          পাসওয়ার্ড ভুলে গেছেন?
        </Link>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "লগইন"
          )}
        </button>

        <div className="flex flex-col gap-1 text-right text-sm pt-1">
          <Link to={paths.register} className="link link-hover text-base-content/70">
          ঠিকাদার হলে আগে রেজিস্ট্রেশন করুন?
          </Link>
        </div>
   
      </form>
    </div>
  );
};
