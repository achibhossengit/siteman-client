import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.jsx";
import { usePermissions } from "../hooks/usePermissions.js";
import { paths } from "../router/paths.js";
import { formatDateBn } from "../utils/dateRange.js";
import { alertSubscriptionExpiry } from "../utils/feedback.js";
import {
  getSubscriptionExpiryStatus,
  SUBSCRIPTION_UPDATE_ASK_ADMIN,
} from "../utils/subscription.js";

const expiryCopy = (status, isCompanyAdmin) => {
  const date = formatDateBn(status.paidUntil);
  const askAdmin = SUBSCRIPTION_UPDATE_ASK_ADMIN;

  if (status.kind === "expired") {
    return {
      title: "সাবস্ক্রিপশনের মেয়াদ শেষ",
      text: isCompanyAdmin
        ? "আপনার সাবস্ক্রিপশনের মেয়াদ শেষ হয়ে গেছে। এখন শুধুমাত্র আগের রেকর্ডগুলো দেখা যাবে, নতুন কোনো রেকর্ড যোগ করা যাবে না। কাজ চালিয়ে যেতে প্ল্যান আপডেট করুন।"
        : `আপনার কোম্পানির সাবস্ক্রিপশনের মেয়াদ শেষ হয়ে গেছে। এখন শুধুমাত্র আগের রেকর্ডগুলো দেখা যাবে, নতুন কোনো রেকর্ড যোগ করা যাবে না। ${askAdmin}`,
    };
  }

  return {
    title: "সাবস্ক্রিপশনের মেয়াদ শেষ হতে যাচ্ছে",
    text: isCompanyAdmin
      ? `আপনার সাবস্ক্রিপশনের মেয়াদ ${date} তারিখে শেষ হবে। মেয়াদ শেষ হলে শুধুমাত্র আগের রেকর্ডগুলো দেখা যাবে, নতুন কোনো রেকর্ড যোগ করা যাবে না। কাজ চালিয়ে যেতে প্ল্যান আপডেট করুন।`
      : `আপনার কোম্পানির সাবস্ক্রিপশনের মেয়াদ ${date} তারিখে শেষ হবে। মেয়াদ শেষ হলে শুধুমাত্র আগের রেকর্ডগুলো দেখা যাবে, নতুন কোনো রেকর্ড যোগ করা যাবে না। ${askAdmin}`,
  };
};

let shownThisLoad = false;

/**
 * Expiry popup on each page load (refresh). SPA navigation does not re-open it.
 * Company admin: আপডেট করুন / এখন না. Others: ঠিক আছে.
 */
export const SubscriptionExpiryPopup = () => {
  const { profile } = useAuth();
  const { isCompanyAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const status = getSubscriptionExpiryStatus(profile);
  const kind = status?.kind;
  const paidUntil = status?.paidUntil;

  useEffect(() => {
    if (!status) return;
    if (location.pathname === paths.companySettings) return;
    if (shownThisLoad) return;

    shownThisLoad = true;
    const { title, text } = expiryCopy(status, isCompanyAdmin);

    void alertSubscriptionExpiry({
      title,
      text,
      showActions: isCompanyAdmin,
    }).then((goUpdate) => {
      if (goUpdate) navigate(paths.companySettings);
    });
  }, [kind, paidUntil, isCompanyAdmin, navigate, location.pathname]);

  return null;
};
