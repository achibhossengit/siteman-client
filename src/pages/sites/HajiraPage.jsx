import { useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  fetchBillingCategories,
  fetchLabourAttendances,
  fetchLabourPayments,
} from "../../api/sites.js";
import {
  mergeHajiraRows,
  summarizeHajiraRows,
} from "../../api/types/hajira.js";
import { parseApiError } from "../../api/errors.js";
import { ApiErrorAlert } from "../../components/ApiErrorAlert.jsx";
import { formatBnNumber, formatBnSigned } from "../../utils/format.js";
import { usePermissions } from "../../hooks/usePermissions.js";
import { PERMS } from "../../utils/permissions.js";
import { paths } from "../../router/paths.js";

const colgroup = (
  <colgroup>
    <col className="w-10" />
    <col />
    <col className="w-16 sm:w-20" />
    <col className="w-24 sm:w-28" />
    <col className="w-20 sm:w-28" />
  </colgroup>
);

export const HajiraPage = () => {
  const { date, siteId, sites } = useOutletContext();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const canAddAttendance = can(PERMS.addAttendance);
  const site = (sites ?? []).find((s) => String(s.id) === String(siteId));
  const siteInactive = site?.is_active === false;

  const attendanceQuery = useQuery({
    queryKey: ["sites", siteId, "labour-attendances", { date }],
    queryFn: async () => {
      const { data } = await fetchLabourAttendances(siteId, { date });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId && date),
  });

  const paymentQuery = useQuery({
    queryKey: ["sites", siteId, "labour-payments", { date }],
    queryFn: async () => {
      const { data } = await fetchLabourPayments(siteId, { date });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId && date),
  });

  const billingQuery = useQuery({
    queryKey: ["sites", siteId, "billing-categories"],
    queryFn: async () => {
      const { data } = await fetchBillingCategories(siteId, {
        is_active: true,
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(siteId),
  });

  const billingLabelById = useMemo(() => {
    const map = new Map();
    for (const b of billingQuery.data ?? []) {
      map.set(b.id, b.name);
    }
    return map;
  }, [billingQuery.data]);

  const rows = useMemo(
    () => mergeHajiraRows(attendanceQuery.data ?? [], paymentQuery.data ?? []),
    [attendanceQuery.data, paymentQuery.data],
  );

  const {
    present: totalPresent,
    extra: totalExtra,
    payment: totalPayment,
  } = useMemo(() => summarizeHajiraRows(rows), [rows]);

  const billingLabel = (id) => {
    if (id == null) return "—";
    return billingLabelById.get(id) ?? `#${id}`;
  };

  if (!siteId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-base-content/70">
        হাজিরা দেখতে একটি সাইট নির্বাচন করুন।
      </div>
    );
  }

  const isLoading = attendanceQuery.isLoading || paymentQuery.isLoading;
  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const error = attendanceQuery.error || paymentQuery.error;
  if (error) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ApiErrorAlert error={parseApiError(error)} />
      </div>
    );
  }

  return (
    <section className="flex-1 min-h-0 flex flex-col relative">
      <div className="shrink-0 bg-base-100 border-b border-base-300">
        <table className="table table-fixed table-sm sm:table-md w-full">
          {colgroup}
          <thead>
            <tr>
              <th>নং</th>
              <th>নাম</th>
              <th className="text-right">হাজিরা</th>
              <th>বিলিং</th>
              <th className="text-right">পেমেন্ট</th>
            </tr>
          </thead>
        </table>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="table table-fixed table-sm sm:table-md w-full">
          {colgroup}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  এই তারিখে কোনো হাজিরা নেই।
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.key} className="border-b border-base-300/70">
                  <td className="tabular-nums text-base-content/60">
                    {formatBnNumber(index + 1)}
                  </td>
                  <td className="truncate font-medium">{row.labour_name}</td>
                  <td className="text-right tabular-nums">
                    <p>{formatBnNumber(row.present)}</p>
                    <p>{formatBnNumber(row.extra)}</p>
                  </td>
                  <td className="truncate text-sm text-base-content/70">
                    {billingLabel(row.billing)}
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {row.payment < 0
                      ? formatBnSigned(row.payment, { showPlus: false })
                      : formatBnNumber(row.payment)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t-2 border-base-300 bg-base-100">
        <table className="table table-fixed table-sm sm:table-md w-full">
          {colgroup}
          <tfoot>
            <tr>
              <td />
              <td className="font-semibold">মোট</td>
              <td className="text-right tabular-nums font-semibold">
                <p>{formatBnNumber(totalPresent)}</p>
                <p>{formatBnNumber(totalExtra)}</p>
              </td>
              <td />
              <td className="text-right tabular-nums font-semibold">
                {totalPayment < 0
                  ? formatBnSigned(totalPayment, { showPlus: false })
                  : formatBnNumber(totalPayment)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {canAddAttendance ? (
        <button
          type="button"
          className="btn btn-primary btn-circle btn-lg fixed bottom-16 right-4 z-40 shadow-lg"
          aria-label="নতুন হাজিরা"
          onClick={() => navigate(paths.hajiraNew)}
          disabled={!date || siteInactive}
        >
          <Plus className="size-7" strokeWidth={2} />
        </button>
      ) : null}
    </section>
  );
};
