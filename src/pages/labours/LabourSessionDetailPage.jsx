import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import {
  closeLabourSession,
  deleteLabourSession,
  fetchLabourAttendancesByLabour,
  fetchLabourDetail,
  fetchLabourLatestSession,
  fetchLabourPaymentsByLabour,
  fetchLabourRunningSession,
  fetchLabourSession,
} from "../../api/labours.js";
import { fetchSites } from "../../api/sites.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { usePermissions } from "../../hooks/usePermissions.js";
import { paths } from "../../router/paths.js";
import { formatBnNumber, formatBnSigned } from "../../utils/format.js";
import { PERMS } from "../../utils/permissions.js";

const num = (v, fallback = 0) => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatPeriodDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("bn-BD", {
    day: "numeric",
    month: "short",
  }).format(d);
};

const formatPeriod = (session) => {
  const start = formatPeriodDate(session?.start_date);
  if (session?.is_running) return `${start} – চলমান`;
  return `${start} – ${formatPeriodDate(session?.end_date)}`;
};

const matchesPaymentFilter = (payment, filter) => {
  if (!filter || filter === "payment") return true;
  if (filter === "khoraki") {
    return payment.type === "payment" && payment.category === "fooding";
  }
  if (filter === "advance") {
    return payment.type === "payment" && payment.category === "advance";
  }
  if (filter === "return") {
    return (
      payment.type === "return"
    );
  }
  return true;
};

const groupPaymentsByDate = (payments, paymentFilter = "payment") => {
  const map = new Map();
  for (const payment of payments) {
    if (!matchesPaymentFilter(payment, paymentFilter)) continue;
    const key = payment.date ?? "";
    const entry = map.get(key) ?? { pay: 0, return: 0 };
    if (payment.type === "return") entry.return += num(payment.amount);
    else entry.pay += num(payment.amount);
    map.set(key, entry);
  }
  return map;
};

const calcDayEarnings = (attendance, earningsFilter = "all") => {
  const hajira = num(attendance?.present) * num(attendance?.salary);
  const extra = num(attendance?.extra);
  if (earningsFilter === "hajira") return hajira;
  if (earningsFilter === "extra") return extra;
  return hajira + extra;
};

const buildDetailRows = (
  attendances,
  payments,
  { paymentFilter = "payment", earningsFilter = "all" } = {},
) => {
  const attendanceByDate = new Map(
    attendances.map((row) => [row.date ?? "", row]),
  );
  const paymentByDate = groupPaymentsByDate(payments, paymentFilter);
  const dates = new Set([...attendanceByDate.keys(), ...paymentByDate.keys()]);

  return [...dates]
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((date) => {
      const attendance = attendanceByDate.get(date) ?? null;
      const payment = paymentByDate.get(date) ?? { pay: 0, return: 0 };
      return {
        date,
        attendance,
        pay: payment.pay,
        return: payment.return,
        dayEarnings: calcDayEarnings(attendance, earningsFilter),
      };
    });
};

export const LabourSessionDetailPage = () => {
  const { labourId, sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setTitle, setHeaderMenu } = useOutletContext();
  const { can } = usePermissions();
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("payment");
  const [earningsFilter, setEarningsFilter] = useState("all");
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

  const sitesQuery = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data } = await fetchSites();
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(canView && showDetails),
  });

  const session = sessionQuery.data;

  const detailsEnabled = Boolean(
    showDetails && labourId && session?.start_date,
  );

  const attendanceQuery = useQuery({
    queryKey: [
      "labours",
      labourId,
      "session-detail",
      sessionId,
      "attendances",
      { site: selectedSiteId, start: session?.start_date },
    ],
    queryFn: async () => {
      const { data } = await fetchLabourAttendancesByLabour(labourId, {
        date__gte: session?.start_date,
        ...(selectedSiteId ? { site: selectedSiteId } : {}),
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: detailsEnabled,
  });

  const paymentQuery = useQuery({
    queryKey: [
      "labours",
      labourId,
      "session-detail",
      sessionId,
      "payments",
      { site: selectedSiteId, start: session?.start_date },
    ],
    queryFn: async () => {
      const { data } = await fetchLabourPaymentsByLabour(labourId, {
        date__gte: session?.start_date,
        ...(selectedSiteId ? { site: selectedSiteId } : {}),
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: detailsEnabled,
  });

  const labourName = labourQuery.data?.name;

  const detailRows = useMemo(
    () =>
      buildDetailRows(attendanceQuery.data ?? [], paymentQuery.data ?? [], {
        paymentFilter,
        earningsFilter,
      }),
    [attendanceQuery.data, paymentQuery.data, paymentFilter, earningsFilter],
  );

  const siteOptions = useMemo(() => {
    const usedSiteIds = new Set();

    for (const row of attendanceQuery.data ?? []) {
      if (row.site != null) usedSiteIds.add(String(row.site));
    }
    for (const row of paymentQuery.data ?? []) {
      if (row.site != null) usedSiteIds.add(String(row.site));
    }

    const siteNameById = new Map(
      (sitesQuery.data ?? []).map((site) => [String(site.id), site.name]),
    );

    return [...usedSiteIds]
      .sort((a, b) => Number(a) - Number(b))
      .map((siteId) => ({
        id: siteId,
        name: siteNameById.get(siteId) ?? `#${siteId}`,
      }));
  }, [attendanceQuery.data, paymentQuery.data, sitesQuery.data]);

  const detailTotals = useMemo(
    () =>
      detailRows.reduce(
        (acc, row) => {
          acc.present += num(row.attendance?.present);
          acc.dayEarnings += row.dayEarnings;
          acc.pay += row.pay;
          acc.return += row.return;
          return acc;
        },
        { present: 0, dayEarnings: 0, pay: 0, return: 0 },
      ),
    [detailRows],
  );

  const detailsLocked = !isRunningRoute && Boolean(session?.is_modified);
  const resolvedSessionId = session?.id ?? (!isRunningRoute && !isLatestRoute ? sessionId : null);

  const invalidateSessionQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["labours", labourId] });
  };

  const closeMutation = useMutation({
    mutationFn: () => closeLabourSession(labourId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteLabourSession(labourId, id),
  });

  const onCloseSession = async () => {
    const ok = window.confirm(
      "চলমান সেশন ক্লোজ করতে চান? হাজিরা ও পেমেন্ট সিল হয়ে যাবে।",
    );
    if (!ok) return;
    setApiError(null);
    try {
      const { data } = await closeMutation.mutateAsync();
      await invalidateSessionQueries();
      if (data?.id != null) {
        navigate(paths.labourSessionDetail(labourId, data.id), { replace: true });
      } else {
        navigate(paths.labourSessions(labourId), { replace: true });
      }
    } catch (err) {
      setApiError(parseApiError(err));
    }
  };

  const onDeleteSession = async () => {
    if (resolvedSessionId == null) return;
    const ok = window.confirm("এই সেশন মুছে ফেলতে চান?");
    if (!ok) return;
    setApiError(null);
    try {
      await deleteMutation.mutateAsync(resolvedSessionId);
      await invalidateSessionQueries();
      navigate(paths.labourSessions(labourId), { replace: true });
    } catch (err) {
      setApiError(parseApiError(err));
    }
  };

  const loading =
    labourQuery.isLoading ||
    sessionQuery.isLoading ||
    (showDetails && (attendanceQuery.isLoading || paymentQuery.isLoading));

  useEffect(() => {
    setTitle?.(
      isRunningRoute
        ? "চলমান সেশন"
        : isLatestRoute
          ? "সর্বশেষ সেশন"
          : "লেবার সেশন",
    );
    return () => setTitle?.("");
  }, [setTitle, isRunningRoute, isLatestRoute]);

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

  if (labourQuery.isError) {
    return <ApiErrorAlert error={parseApiError(labourQuery.error)} />;
  }

  if (sessionQuery.isError) {
    return <ApiErrorAlert error={parseApiError(sessionQuery.error)} />;
  }

  if (loading && !session) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-sm text-base-content/70 py-8 text-center">
        সেশন পাওয়া যায়নি।
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {apiError ? <ApiErrorAlert error={apiError} /> : null}
      {attendanceQuery.isError || paymentQuery.isError ? (
        <ApiErrorAlert
          error={parseApiError(attendanceQuery.error || paymentQuery.error)}
        />
      ) : null}

      {session.is_modified && !isRunningRoute ? (
        <div className="alert alert-warning py-2 px-3 text-sm">
          <Lock className="size-4" strokeWidth={1.75} />
          সেশনটি পরিবর্তিত হয়েছে। ডিটেইলস ও ডিলিট বন্ধ।
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setShowDetails((v) => !v)}
          disabled={detailsLocked}
        >
          {showDetails ? (
            <>
              ডিটেইলস বন্ধ
              <ChevronUp className="size-4" strokeWidth={1.75} />
            </>
          ) : (
            <>
              ডিটেইলস
              <ChevronDown className="size-4" strokeWidth={1.75} />
            </>
          )}
        </button>

        {showDetails ? (
          <select
            className="select select-bordered select-sm ml-auto max-w-48"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            aria-label="সাইট"
          >
            <option value="">All sites</option>
            {siteOptions.map((site) => (
              <option key={site.id} value={String(site.id)}>
                {site.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {!showDetails ? (
        <section className="overflow-hidden">
          <div className="space-y-2 text-sm">
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
              <span className="text-base-content/70">হাজিরা আয়</span>
              <span className="text-success">
                {formatBnSigned(session.salary_earnings)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-base-content/70">অতিরিক্ত আয়</span>
              <span className="text-success">
                {formatBnSigned(session.extra_earnings)}
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
              <span>সর্বমোট</span>
              <span className="text-success">
                {formatBnNumber(session.cumulative_payable)}
              </span>
            </div>
          </div>

          <div className="p-3 border-t border-base-300 flex justify-end">
            {isRunningRoute ? (
              canClose ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onCloseSession}
                  disabled={closeMutation.isPending}
                >
                  {closeMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  ক্লোজ সেশন
                </button>
              ) : null
            ) : canDelete ? (
              <button
                type="button"
                className="btn btn-error"
                onClick={onDeleteSession}
                disabled={
                  detailsLocked ||
                  resolvedSessionId == null ||
                  deleteMutation.isPending
                }
              >
                {deleteMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : null}
                ডিলিট সেশন
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          {attendanceQuery.isLoading || paymentQuery.isLoading ? (
            <div className="flex justify-center">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-xs sm:table-sm table-zebra">
                <thead>
                  <tr className="border-b border-base-300 text-xs sm:text-sm">
                    <th>নং</th>
                    <th>তারিখ</th>
                    <th>হাজিরা</th>
                    <th className="text-right">
                      <select
                        className="select border-none select-xs font-normal min-w-28"
                        value={earningsFilter}
                        onChange={(e) => setEarningsFilter(e.target.value)}
                        aria-label="আয় ফিল্টার"
                      >
                        <option value="all">আয়</option>
                        <option value="hajira">হাজিরা আয়</option>
                        <option value="extra">অতিরিক্ত আয়</option>
                      </select>
                    </th>
                    <th className="text-right">
                      <select
                        className="select border-none select-xs font-normal min-w-28"
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                        aria-label="পেমেন্ট ফিল্টার"
                      >
                        <option value="payment">পেমেন্ট</option>
                        <option value="khoraki">খোরাকি</option>
                        <option value="advance">অগ্রিম</option>
                        <option value="return">রিটার্ন</option>
                      </select>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center text-sm text-base-content/60 py-10"
                      >
                        কোনো ডিটেইলস পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    detailRows.map((row, index) => (
                      <tr key={row.date}>
                        <td className="tabular-nums">
                          {formatBnNumber(index + 1)}
                        </td>
                        <td className="whitespace-nowrap">
                          {formatPeriodDate(row.date)}
                        </td>
                        <td>
                          {row.attendance ? (
                            <div className="leading-tight space-y-0.5">
                              <div className="tabular-nums">
                                {formatBnNumber(row.attendance.present)}x
                                {formatBnNumber(row.attendance.salary ?? 0)}
                              </div>
                              {num(row.attendance.extra) ? (
                                <div className="tabular-nums">
                                  {formatBnNumber(row.attendance.extra)}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-base-content/40">—</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums">
                          {row.dayEarnings
                            ? formatBnNumber(row.dayEarnings)
                            : "—"}
                        </td>
                        <td className="text-right">
                          {row.pay || row.return ? (
                            <div className="space-y-0.5 leading-tight tabular-nums">
                              {row.pay ? (
                                <div className="text-error">
                                  {formatBnNumber(row.pay)}
                                </div>
                              ) : null}
                              {row.return ? (
                                <div className="text-success">
                                  {formatBnNumber(row.return)}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-base-content/40">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}

                  {detailRows.length > 0 ? (
                    <tr className="font-semibold bg-base-200/40">
                      <td colSpan={2} className="text-end">মোট</td>
                      <td className="tabular-nums">
                        {formatBnNumber(detailTotals.present)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatBnNumber(detailTotals.dayEarnings)}
                      </td>
                      <td className="text-right">
                        <div className="space-y-0.5 leading-tight tabular-nums">
                          <div className="text-error">
                            {formatBnNumber(detailTotals.pay)}
                          </div>
                          <div className="text-success">
                            {formatBnNumber(detailTotals.return)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" className="btn btn-primary">
              বেতন আপডেট
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
