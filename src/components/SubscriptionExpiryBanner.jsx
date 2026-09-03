import { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { usePermissions } from "../hooks/usePermissions.js";
import { paths } from "../router/paths.js";
import { formatDateBn } from "../utils/dateRange.js";
import {
  companyFromProfile,
  getSubscriptionExpiryBanner,
  SUBSCRIPTION_UPDATE_ASK_ADMIN,
} from "../utils/subscription.js";

const DISMISS_KEY = "subscriptionExpiryBannerDismissed";

const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) || "";
  } catch {
    return "";
  }
};

const writeDismissed = (token) => {
  try {
    if (token) sessionStorage.setItem(DISMISS_KEY, token);
    else sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore quota / private mode
  }
};

const dismissTokenFor = (profile, status) => {
  if (!status) return "";
  const companyId = companyFromProfile(profile)?.id ?? "";
  return `${companyId}:${status.kind}:${status.paidUntil}`;
};

const linkClass = "link link-hover text-primary font-medium";

/**
 * Single-line strip under the app/detail header. Dismissed for this tab session.
 */
export const SubscriptionExpiryBanner = () => {
  const { profile } = useAuth();
  const { isCompanyAdmin } = usePermissions();
  const status = getSubscriptionExpiryBanner(profile);
  const token = dismissTokenFor(profile, status);
  const [dismissedToken, setDismissedToken] = useState(readDismissed);

  if (!status || !token || dismissedToken === token) return null;

  const expired = status.kind === "expired";
  const updateAction = isCompanyAdmin ? (
    <Link to={paths.companySettings} className={linkClass}>
      আপডেট করুন
    </Link>
  ) : (
    SUBSCRIPTION_UPDATE_ASK_ADMIN
  );

  return (
    <div
      role="status"
      className={`shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm border-b ${
        expired
          ? "bg-error/12 border-error/20"
          : "bg-warning/15 border-warning/25"
      }`}
    >
      <p className="flex-1 min-w-0 leading-snug">
        {expired ? (
          <>সাবস্ক্রিপশনের মেয়াদ শেষ। {updateAction}</>
        ) : (
          <>
            সাবস্ক্রিপশনের মেয়াদ {formatDateBn(status.paidUntil)} তারিখে শেষ
            হবে। {updateAction}
          </>
        )}
      </p>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle shrink-0"
        aria-label="বন্ধ"
        onClick={() => {
          writeDismissed(token);
          setDismissedToken(token);
        }}
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  );
};
