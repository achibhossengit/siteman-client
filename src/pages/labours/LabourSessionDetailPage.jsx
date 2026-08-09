import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import {
  closeLabourSession,
  deleteLabourSession,
  fetchLabourDetail,
  fetchLabourLatestSession,
  fetchLabourRunningSession,
  fetchLabourSession,
} from "../../api/labours.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { paths } from "../../router/paths.js";
import { confirmAction, toastSuccess } from "../../utils/feedback.js";
import { formatBnNumber, formatBnSigned } from "../../utils/format.js";
import { PERMS } from "../../utils/permissions.js";

const formatPeriodDate = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
  }).format(date);
};

const formatFullDate = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatPeriod = (session) => {
  const start = formatPeriodDate(session?.start_date);
  if (session?.is_running) return `${start} – চলমান`;
  return `${start} – ${formatPeriodDate(session?.end_date)}`;
};

export const LabourSessionDetailPage = () => {
  const { labourId, sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const { can } = usePermissions();
  const [apiError, setApiError] = useState(null);
  const isRunningRoute = sessionId === "running";
  const isLatestRoute = sessionId === "latest";
  const canView = can(PERMS.viewLabourSession);
  const canClose = can(PERMS.addLabourSession);
  const canDelete = can(PERMS.deleteLabourSession);

  const labourQuery = useQuery({
    queryKey: ["labours", labourId],
    queryFn: async () => {
      const { data } = await fetchLabourDetail(labourId);
      return data;
    },
    enabled: Boolean(canView && labourId),
  });

  const sessionQuery = useQuery({
    queryKey: ["labours", labourId, "session-detail", sessionId],
    queryFn: async () => {
      if (isRunningRoute) {
        const { data } = await fetchLabourRunningSession(labourId);
        return data ? { ...data, is_running: true } : null;
      }
      if (isLatestRoute) {
        const { data } = await fetchLabourLatestSession(labourId);
        return data;
      }
      const { data } = await fetchLabourSession(labourId, sessionId);
      return data;
    },
    enabled: Boolean(canView && labourId && sessionId),
  });

  const session = sessionQuery.data;
  const labourName = labourQuery.data?.name;
  const recordsLocked = !isRunningRoute && Boolean(session?.is_modified);
  const resolvedSessionId =
    session?.id ?? (!isRunningRoute && !isLatestRoute ? sessionId : null);

  const closeMutation = useMutation({
    mutationFn: () => closeLabourSession(labourId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteLabourSession(labourId, id),
  });

  const invalidateSessionQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["labours", labourId] });
    await queryClient.invalidateQueries({ queryKey: ["activities"] });
  };

  const onCloseSession = async () => {
    const confirmed = await confirmAction({
      title: "চলমান হিসাব ক্লোজ করবেন?",
      text: "হাজিরা ও পেমেন্ট সিল হয়ে যাবে।",
      confirmText: "ক্লোজ করুন",
    });
    if (!confirmed) return;
    setApiError(null);
    try {
      const { data } = await closeMutation.mutateAsync();
      await invalidateSessionQueries();
      toastSuccess("হিসাব ক্লোজ হয়েছে");
      if (data?.id != null) {
        navigate(paths.labourSessionDetail(labourId, data.id), {
          replace: true,
        });
      } else {
        navigate(paths.labourSessions(labourId), { replace: true });
      }
    } catch (error) {
      setApiError(parseApiError(error));
    }
  };

  const onDeleteSession = async () => {
    if (resolvedSessionId == null) return;
    const confirmed = await confirmAction({
      title: "হিসাব মুছে ফেলবেন?",
      text: "এই কাজটি ফিরিয়ে আনা যাবে না।",
      confirmText: "ডিলিট করুন",
      danger: true,
    });
    if (!confirmed) return;
    setApiError(null);
    try {
      await deleteMutation.mutateAsync(resolvedSessionId);
      await invalidateSessionQueries();
      toastSuccess("হিসাব ডিলিট হয়েছে");
      navigate(paths.labourSessions(labourId), { replace: true });
    } catch (error) {
      setApiError(parseApiError(error));
    }
  };

  useEffect(() => {
    setTitle?.("হিসাব ডিটেইল");
    return () => setTitle?.("");
  }, [setTitle]);

  useEffect(() => {
    setHeaderMenu?.(
      labourName ? (
        <span className="text-sm font-medium text-base-content/80 truncate px-1 max-w-full">
          {labourName}
        </span>
      ) : null,
    );
    return () => setHeaderMenu?.(null);
  }, [labourName, setHeaderMenu]);

  if (!canView) {
    return (
      <div className="text-sm text-error py-8 text-center">
        এই পেজ দেখার অনুমতি নেই।
      </div>
    );
  }

  if (labourQuery.isError || sessionQuery.isError) {
    return (
      <ApiErrorAlert
        error={parseApiError(labourQuery.error || sessionQuery.error)}
      />
    );
  }

  if ((labourQuery.isLoading || sessionQuery.isLoading) && !session) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        হিসাব পাওয়া যায়নি।
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {apiError ? <ApiErrorAlert error={apiError} /> : null}

      {recordsLocked ? (
        <div className="alert alert-warning py-2 px-3 text-sm">
          <Lock className="size-4" strokeWidth={1.75} />
          হিসাবটি পরিবর্তিত হয়েছে। রেকর্ড ও ডিলিট বন্ধ।
        </div>
      ) : null}

      <section className="overflow-hidden">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-base-content/70">তৈরির তারিখ</span>
            <span className="font-medium whitespace-nowrap">
              {formatFullDate(session.created_date || session.created_at)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-base-content/70">সময়কাল</span>
            <span className="font-medium whitespace-nowrap">
              {formatPeriod(session)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-base-content/70">মোট হাজিরা</span>
            <span>{formatBnNumber(session.present_days)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-base-content/70">মোট আয়</span>
            <span className="text-success">
              {formatBnSigned(
                session.total_earnings ??
                  Number(session.salary_earnings || 0) +
                    Number(session.extra_earnings || 0),
              )}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-base-content/70">মোট পেমেন্ট</span>
            <span className="text-error">
              {formatBnSigned(-Math.abs(session.total_payment), {
                showPlus: false,
              })}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-base-content/70">মোট রিটার্ন</span>
            <span className="text-success">
              {formatBnSigned(session.total_return)}
            </span>
          </div>
          <div className="border-t border-base-300 pt-2 flex justify-between gap-3 font-semibold">
            <span>পাওনা</span>
            <span className="text-success">
              {formatBnNumber(session.payable)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-base-content/70">আগের পাওনা</span>
            <span className="text-error">
              {formatBnSigned(-Math.abs(session.previous_payable), {
                showPlus: false,
              })}
            </span>
          </div>
          <div className="border-t border-base-300 pt-2 flex justify-between gap-3 font-semibold">
            <span>সর্বমোট পাওনা</span>
            <span className="text-success">
              {formatBnNumber(session.cumulative_payable)}
            </span>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-base-300 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              navigate(paths.labourSessionRecords(labourId, sessionId))
            }
            disabled={recordsLocked}
          >
            ডিটেইলস
          </button>

          {canDelete && !isRunningRoute ? (
            <button
              type="button"
              className="btn btn-error btn-sm"
              onClick={onDeleteSession}
              disabled={
                recordsLocked ||
                resolvedSessionId == null ||
                deleteMutation.isPending
              }
            >
              {deleteMutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : null}
              ডিলিট
            </button>
          ) : null}

          {isRunningRoute && canClose ? (
            <button
              type="button"
              className="btn btn-primary btn-sm ms-auto"
              onClick={onCloseSession}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : null}
              হিসাব ক্লোজ করুন
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
};
