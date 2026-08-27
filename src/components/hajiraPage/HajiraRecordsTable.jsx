import { Fragment } from "react";
import { Link } from "react-router-dom";
import { activityToneClass } from "../../api/types/activity.js";
import { messageForCode } from "../../api/errors.js";
import { PersonAvatar } from "../PersonAvatar.jsx";
import { SHOW_BILLING } from "../../config/features.js";
import { paths } from "../../router/paths.js";
import {
  concatLabourName,
  formatBnNumber,
} from "../../utils/format.js";
import {
  EARNINGS_DEFAULT_FIELDS,
  HAJIRA_DEFAULT_FIELDS,
  LABOUR_DEFAULT_FIELDS,
  PAYMENT_DEFAULT_FIELDS,
} from "./constants.js";
import {
  advanceAmountOf,
  attendanceCellLines,
  dayEarnings,
  fieldTone,
  filterHeaderTitle,
  hasAmount,
  hasBilling,
  isPendingCreateRow,
  paymentAmountOf,
  paymentLineTone,
  recordIdOf,
  recordSealedOf,
} from "./helpers.js";

export function HajiraRecordsTable({
  selectMode,
  canChangeActivityLog,
  allPendingSelected,
  somePendingSelected,
  pendingIds,
  toggleSelectAll,
  setSelectMode,
  openLabourFilterModal,
  labourFilter,
  openHajiraModal,
  hajiraFilter,
  showAyColumn,
  openEarningsFilterModal,
  earningsFilter,
  openPaymentModal,
  paymentFilter,
  openBillingModal,
  billingFilterHeaderLabel,
  tableColCount,
  visibleRows,
  emptyMessage,
  initialByLabour,
  activityIdsForRow,
  selectedIds,
  viewEarningsFilter,
  viewPaymentFilter,
  showReturnAmount,
  viewHajiraFields,
  billingFullLabelForRow,
  saveRowErrors,
  isLabourOffSite,
  openRecordModal,
  toggleRowSelected,
  canOpenLabourDetail,
  showLabourDetailDenied,
  billingLabelForRow,
  totals,
  date,
}) {
  return (
      <div className="flex-1 min-h-0 overflow-auto pb-24">
        <table className="table table-sm sm:table-md w-full">
          <thead className="sticky top-0 z-10 bg-base-100">
            <tr className="border-b border-base-300 text-sm">
              <th>
                {selectMode && canChangeActivityLog ? (
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allPendingSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          somePendingSelected && !allPendingSelected;
                      }
                    }}
                    disabled={pendingIds.length === 0}
                    aria-label="সব নির্বাচন"
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                ) : canChangeActivityLog ? (
                  <button
                    type="button"
                    className="font-bold"
                    onClick={() => setSelectMode(true)}
                    title="নির্বাচন মোড"
                  >
                    নং
                  </button>
                ) : (
                  "নং"
                )}
              </th>
              <th>
                <button
                  type="button"
                  onClick={openLabourFilterModal}
                >
                  {filterHeaderTitle("নাম", labourFilter, LABOUR_DEFAULT_FIELDS)}
                </button>
              </th>
              <th className="text-right">
                <button type="button" onClick={openHajiraModal}>
                  {filterHeaderTitle(
                    "হাজিরা",
                    hajiraFilter,
                    HAJIRA_DEFAULT_FIELDS,
                  )}
                </button>
              </th>
              {showAyColumn ? (
                <th className="text-right">
                  <button
                    type="button"
                    onClick={openEarningsFilterModal}
                  >
                    {filterHeaderTitle(
                      "আয়",
                      earningsFilter,
                      EARNINGS_DEFAULT_FIELDS,
                    )}
                  </button>
                </th>
              ) : null}
              <th className="text-right">
                <button type="button" onClick={openPaymentModal}>
                  {filterHeaderTitle(
                    "লেনদেন",
                    paymentFilter,
                    PAYMENT_DEFAULT_FIELDS,
                  )}
                </button>
              </th>
              {SHOW_BILLING ? (
                <th className="text-right">
                  <button type="button" onClick={openBillingModal}>
                    {billingFilterHeaderLabel}
                  </button>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColCount}
                  className="text-center text-sm text-base-content/60 py-10"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const initial = initialByLabour.get(row.labourId) ?? {};
                const rowActivityIds = activityIdsForRow(row);
                const selectable = rowActivityIds.length > 0;
                const rowSelected =
                  selectable &&
                  rowActivityIds.every((id) => selectedIds.has(id));
                const hajiraDirtyTone = fieldTone(
                  row,
                  initial,
                  ["present", "salary", "extra", "extraNote", "billing"],
                  "attendanceId",
                );
                // Hajira / আয়: normal text (no activity/create green).
                const hajiraGroupTone =
                  hajiraDirtyTone === "text-amber-500"
                    ? "text-amber-500"
                    : "text-base-content";
                const earn = dayEarnings(row, viewEarningsFilter);
                const paymentPart = viewPaymentFilter.includes("payment")
                  ? hasAmount(row.payment)
                    ? paymentAmountOf(row)
                    : null
                  : null;
                const advancePart = viewPaymentFilter.includes("advance")
                  ? hasAmount(row.advance)
                    ? advanceAmountOf(row)
                    : null
                  : null;
                const outflowParts = [paymentPart, advancePart].filter(
                  (v) => v != null,
                );
                const showOutflow = outflowParts.length > 0;
                const outflow = outflowParts.reduce((sum, n) => sum + n, 0);
                const showRet = showReturnAmount(row);
                const attendanceLines = attendanceCellLines(
                  row,
                  (id) => billingFullLabelForRow(row),
                  viewHajiraFields,
                );
                const pendingCreate = isPendingCreateRow(row, initial, date);
                const rowToneClass = pendingCreate
                  ? "[&>td]:bg-success/50"
                  : activityToneClass(row.activityTone);
                const rowSaveErrors =
                  saveRowErrors[Number(row.labourId)] ??
                  saveRowErrors[row.labourId] ??
                  null;
                const hasSaveError = Boolean(
                  rowSaveErrors && rowSaveErrors.length,
                );
                const sealed = recordSealedOf(row);
                const offSite = isLabourOffSite(row);
                const nameMutedClass = offSite
                  ? "text-base-content/45"
                  : "";
                const sealedContentClass = sealed ? "opacity-50" : "";

                return (
                  <Fragment key={row.labourId}>
                  <tr
                    className={[
                      "border-b border-base-300/70 cursor-pointer",
                      hasSaveError ? "bg-error/10" : rowToneClass,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => openRecordModal(row)}
                    title={
                      sealed
                        ? messageForCode("record_sealed")
                        : pendingCreate
                          ? "নতুন হাজিরা — নিশ্চিত করলে তৈরি হবে"
                          : offSite
                            ? "এই শ্রমিক আর এই সাইটে নেই"
                            : undefined
                    }
                  >
                    <td className="tabular-nums text-base-content/60">
                      <span className={sealedContentClass || undefined}>
                      {selectMode && canChangeActivityLog ? (
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={rowSelected}
                          disabled={!selectable}
                          aria-label={`নির্বাচন ${formatBnNumber(index + 1)}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            toggleRowSelected(row, e.target.checked)
                          }
                        />
                      ) : (
                        formatBnNumber(index + 1)
                      )}
                      </span>
                    </td>
                    <td
                      className={["font-medium", nameMutedClass]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {row.labourId != null && canOpenLabourDetail(row) ? (
                            <Link
                              to={paths.labourDetail(row.labourId)}
                              className={[
                                "flex items-center gap-2 min-w-0",
                                nameMutedClass,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              title={
                                offSite
                                  ? "এই শ্রমিক আর এই সাইটে নেই"
                                  : row.labourName
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PersonAvatar
                                photo={row.labourPhoto}
                                name={row.labourName}
                                size="xs"
                                shape="square"
                              />
                              <span className="link link-hover">
                                {concatLabourName(row.labourName)}
                              </span>
                            </Link>
                          ) : row.labourId != null ? (
                            <button
                              type="button"
                              className={[
                                "flex items-center gap-2 min-w-0 text-left cursor-pointer",
                                "text-base-content/60",
                                nameMutedClass,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              title="এই শ্রমিকের সাইটে অনুমতি নেই"
                              onClick={(e) => {
                                e.stopPropagation();
                                void showLabourDetailDenied(row);
                              }}
                            >
                              <PersonAvatar
                                photo={row.labourPhoto}
                                name={row.labourName}
                                size="xs"
                                shape="square"
                              />
                              {concatLabourName(row.labourName)}
                            </button>
                          ) : (
                            <span className="flex items-center gap-2 min-w-0">
                              <PersonAvatar
                                photo={row.labourPhoto}
                                name={row.labourName}
                                size="xs"
                                shape="square"
                              />
                              {concatLabourName(row.labourName)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      className={["text-right", hajiraGroupTone]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span
                        className={[
                          "block w-full space-y-0.5 text-right leading-tight",
                          sealedContentClass,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {attendanceLines.map((line) => (
                          <span
                            key={line.key}
                            className="block w-full truncate text-right"
                            title={line.value}
                          >
                            <span className={line.isNumber ? "tabular-nums" : ""}>
                              {line.value}
                            </span>
                          </span>
                        ))}
                      </span>
                    </td>
                    {showAyColumn ? (
                      <td
                        className={["text-right tabular-nums", hajiraGroupTone]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className={sealedContentClass || undefined}>
                          {earn ? formatBnNumber(earn) : "—"}
                        </span>
                      </td>
                    ) : null}
                    <td className="text-right">
                      <span
                        className={[
                          "block w-full",
                          sealedContentClass,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                      {showOutflow || showRet ? (
                        <span className="block w-full tabular-nums space-y-0.5 text-right leading-tight">
                          {showOutflow ? (
                            <span
                              className={`block w-full text-right ${paymentLineTone(
                                row,
                                initial,
                                [
                                  "payment",
                                  "paymentNote",
                                  "advance",
                                  "advanceNote",
                                ],
                                "paymentId",
                                "text-error",
                              )}`}
                            >
                              {formatBnNumber(outflow)}
                            </span>
                          ) : null}
                          {showRet ? (
                            <span
                              className={`block w-full text-right ${paymentLineTone(
                                row,
                                initial,
                                ["return", "returnNote"],
                                "returnId",
                                "text-base-content",
                              )}`}
                            >
                              {formatBnNumber(row.return)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="block w-full text-right text-base-content/60">
                          —
                        </span>
                      )}
                      </span>
                    </td>
                    {SHOW_BILLING ? (
                    <td
                      className="text-right text-sm whitespace-nowrap"
                      title={
                        hasBilling(row) || recordIdOf(row)
                          ? billingFullLabelForRow(row)
                          : undefined
                      }
                    >
                      <span className={sealedContentClass || undefined}>
                      {hasBilling(row) || recordIdOf(row)
                        ? billingLabelForRow(row)
                        : "—"}
                      </span>
                    </td>
                    ) : null}
                  </tr>
                  {hasSaveError ? (
                    <tr
                      className={[
                        "border-b border-base-300/70 bg-error/10",
                        sealed ? "opacity-50" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <td
                        colSpan={tableColCount}
                        className="py-1.5 text-xs text-error font-normal whitespace-normal leading-snug"
                      >
                        {rowSaveErrors.join(" · ")}
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {visibleRows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-base-300">
                <td />
                <td className="whitespace-nowrap">মোট</td>
                <td className="text-right tabular-nums">
                  {totals.present ? formatBnNumber(totals.present) : "—"}
                </td>
                {showAyColumn ? (
                  <td className="text-right tabular-nums">
                    {totals.earnings ? formatBnNumber(totals.earnings) : "—"}
                  </td>
                ) : null}
                <td className="text-right">
                  {totals.payment || totals.advance || totals.return ? (
                    <span className="block w-full tabular-nums space-y-0.5 text-right">
                      {totals.payment || totals.advance ? (
                        <span className="block w-full text-right text-error">
                          {formatBnNumber(totals.payment + totals.advance)}
                        </span>
                      ) : null}
                      {totals.return ? (
                        <span className="block w-full text-right text-base-content">
                          {formatBnNumber(totals.return)}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="block w-full text-right text-base-content/60">
                      —
                    </span>
                  )}
                </td>
                {SHOW_BILLING ? (
                <td className="text-right text-base-content/60">—</td>
                ) : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
  );
}
