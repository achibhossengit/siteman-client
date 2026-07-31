import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { passwordResetConfirm, passwordResetResendOtp } from "../../api/auth.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { OtpForm } from "../../components/auth/OtpForm.jsx";
import { paths } from "../../router/paths.js";
import { toastSuccess } from "../../utils/feedback.js";
import {
  OTP_STORAGE,
  clearOtpSession,
  getOtpDeadlines,
  readOtpSession,
  saveOtpSession,
} from "../../utils/otpSession.js";

export const PasswordResetConfirmPage = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState(() =>
    readOtpSession(OTP_STORAGE.passwordReset),
  );
  const initialDeadlines = getOtpDeadlines(session);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otpError, setOtpError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [expiresAt, setExpiresAt] = useState(initialDeadlines.expiresAt);
  const [resendAt, setResendAt] = useState(initialDeadlines.resendAt);

  if (!session?.ticket) {
    return <Navigate to={paths.passwordReset} replace />;
  }

  const onSubmit = async () => {
    setApiError(null);
    setOtpError(null);
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError("কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড");
      return;
    }

    setSubmitting(true);
    try {
      await passwordResetConfirm({
        ticket: session.ticket,
        otp,
        new_password: newPassword,
      });
      clearOtpSession(OTP_STORAGE.passwordReset);
      toastSuccess("পাসওয়ার্ড আপডেট হয়েছে — এখন লগইন করুন", {
        id: "login-success:passwordReset",
      });
      navigate(paths.login, { replace: true, state: { passwordReset: true } });
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      if (parsed.fieldErrors?.otp) setOtpError(parsed.fieldErrors.otp[0]);
      if (parsed.fieldErrors?.new_password) {
        setPasswordError(parsed.fieldErrors.new_password[0]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setApiError(null);
    setResending(true);
    try {
      const { data } = await passwordResetResendOtp({ ticket: session.ticket });
      const saved = saveOtpSession(OTP_STORAGE.passwordReset, {
        ...session,
        ticket: data.ticket || session.ticket,
        otp_expires_in: data.otp_expires_in ?? 300,
        resend_cooldown: data.resend_cooldown ?? 60,
      });
      setSession(saved);
      const next = getOtpDeadlines(saved);
      setExpiresAt(next.expiresAt);
      setResendAt(next.resendAt);
      setOtp("");
      toastSuccess("নতুন OTP পাঠানো হয়েছে");
    } catch (err) {
      setApiError(parseApiError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body gap-3">
        <h1 className="card-title justify-center text-2xl">নতুন পাসওয়ার্ড</h1>
        <p className="text-center text-sm text-base-content/70 -mt-1">
          OTP ও নতুন পাসওয়ার্ড দিন
        </p>

        <ApiErrorAlert error={apiError} />

        <OtpForm
          otp={otp}
          onOtpChange={setOtp}
          onSubmit={onSubmit}
          onResend={onResend}
          submitting={submitting}
          resending={resending}
          expiresAt={expiresAt}
          resendAt={resendAt}
          error={otpError}
          submitLabel="পাসওয়ার্ড সেভ করুন"
        >
          <label className="form-control w-full">
            <span className="label-text mb-1">নতুন পাসওয়ার্ড</span>
            <input
              type="password"
              autoComplete="new-password"
              className={`input input-bordered w-full ${passwordError ? "input-error" : ""}`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {passwordError ? (
              <span className="label-text-alt text-error mt-1">
                {passwordError}
              </span>
            ) : null}
          </label>
        </OtpForm>

        <p className="text-center text-sm">
          <Link
            to={paths.passwordReset}
            className="link link-hover"
            onClick={() => clearOtpSession(OTP_STORAGE.passwordReset)}
          >
            বাতিল / ফিরে যান
          </Link>
        </p>
      </div>
    </div>
  );
};
