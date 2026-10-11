import { Fragment } from "react";
import { Link } from "react-router-dom";
import {
  activityCellToneClass,
  activityToneClass,
} from "../../api/types/activity.js";
import { messageForCode } from "../../api/errors.js";
import { PersonAvatar } from "../PersonAvatar.jsx";
import { SHOW_BILLING } from "../../config/features.js";
import { paths } from "../../router/paths.js";
import { formatBnNumber } from "../../utils/format.js";
import {
  EARNINGS_DEFAULT_FIELDS,
  LABOUR_DEFAULT_FIELDS,
} from "./constants.js";
import {
  dayEarnings,
  fieldTone,
  filterHeaderTitle,
  hasBilling,
  isPendingCreateRow,
  paymentLineTone,
  recordIdOf,
  recordSealedOf,
} from "./helpers.js";

const BORDER_Y = "border-b border-b-base-content/35";
const BORDER_Y_SOFT = "border-b border-b-base-content/15";
const BORDER_X = "border-r border-r-base-content/35";
const BORDER_X_INNER = "border-r border-r-base-content/15";
const CELL = `${BORDER_Y} ${BORDER_X}`;
const CELL_PHOTO = BORDER_Y;
const CELL_TOP = `${BORDER_Y_SOFT} ${BORDER_X}`;
const CELL_TOP_INNER = `${BORDER_Y_SOFT} ${BORDER_X_INNER}`;
const CELL_SUB = `${BORDER_Y} ${BORDER_X}`;
const CELL_SUB_INNER = `${BORDER_Y} ${BORDER_X_INNER}`;
const HEAD_BG = "!bg-base-300";
const ROW_EVEN = "!bg-base-100";
const ROW_ODD = "!bg-base-200";
const FOOT_BG = "!bg-base-300";
const FOOT_REMAIN_BG = FOOT_BG;
const VALUE_CELL =
  "text-right align-middle tabular-nums whitespace-nowrap leading-tight px-1 text-xs";
const PAIR_COL = "w-[22%] min-w-16";

const num = (v) => Number(v) || 0;

const takenOf = (obj) =>
  obj?.taken != null ? num(obj.taken) : num(obj?.payment) + num(obj?.advance);

const payableOf = (obj) =>
  obj?.payable != null ? num(obj.payable) : num(obj?.earnings) - takenOf(obj);

const signedTone = (value) =>
  value > 0 ? "text-success" : value < 0 ? "text-error" : "";

const Amount = ({ value, tone }) => {
  if (!value) {
    return <span className="opacity-35">—</span>;
  }
  return (
    <span className={tone || undefined}>{formatBnNumber(value)}</span>
  );
};

const PresentTimesSalary = ({ present, salary, showSalary }) => (
  <span className="inline-flex w-full items-center justify-end gap-0.5 tabular-nums">
    <Amount value={present} />
    {showSalary ? (
      <>
        <span className="opacity-50">×</span>
        <Amount value={salary} />
      </>
    ) : null}
  </span>
);

const cellFill = ({ hasSaveError, pendingCreate, activityTone, index }) => {
  if (hasSaveError) return "!bg-error/10";
  if (pendingCreate) return "!bg-success/50";
  const activity = activityCellToneClass(activityTone);
  if (activity) return activity;
  return index % 2 === 0 ? ROW_EVEN : ROW_ODD;
};

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
  paymentFilter,
  showSalary,
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
  void hajiraFilter;
  void viewPaymentFilter;
  void viewHajiraFields;

  return (
    <div className="flex-1 min-h-0 overflow-auto pb-24">
      <table className="table table-xs table-fixed w-full bg-transparent text-xs border-separate border-spacing-0 border-t border-l border-base-content/35 [&_th]:!px-1 [&_th]:!py-2 sm:[&_th]:!py-3 [&_th]:!bg-base-300 [&_td]:!px-0.5 [&_td]:!py-1 [&_tbody_tr]:bg-transparent [&_tbody_td]:bg-transparent [&_tbody_tr:hover]:bg-transparent [&_tfoot_tr]:bg-transparent [&_tfoot_td]:bg-transparent">
        <colgroup>
          <col className="w-10" />
          <col className="w-8" />
          <col />
          <col className={PAIR_COL} />
          <col className={PAIR_COL} />
          {showAyColumn ? <col className="w-[12%] min-w-12" /> : null}
          {SHOW_BILLING ? <col className="w-[12%] min-w-12" /> : null}
        </colgroup>
        <thead className={`sticky top-0 z-10 ${HEAD_BG}`}>
          <tr>
            <th className={`w-10 align-middle text-center ${CELL} ${HEAD_BG}`}>
              <span className="inline-flex w-full items-center justify-center">
                {selectMode && canChangeActivityLog ? (
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
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
              </span>
            </th>
            <th className={`w-8 px-0 ${CELL_PHOTO} ${HEAD_BG}`} />
            <th className={`min-w-0 pl-1 align-middle ${CELL} ${HEAD_BG}`}>
              <button type="button" onClick={openLabourFilterModal}>
                {filterHeaderTitle("নাম", labourFilter, LABOUR_DEFAULT_FIELDS)}
              </button>
            </th>
            <th
              colSpan={2}
              className={`text-center align-middle font-medium ${CELL} ${HEAD_BG}`}
            >
              <button type="button" onClick={openHajiraModal}>
                হাজিরা
              </button>
            </th>
            {showAyColumn ? (
              <th className={`text-right align-middle ${CELL} ${HEAD_BG}`}>
                <button type="button" onClick={openEarningsFilterModal}>
                  {filterHeaderTitle(
                    "আয়",
                    earningsFilter,
                    EARNINGS_DEFAULT_FIELDS,
                  )}
                </button>
              </th>
            ) : null}
            {SHOW_BILLING ? (
              <th className={`text-right align-middle ${CELL} ${HEAD_BG}`}>
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
                className={`text-center text-sm text-base-content/60 !py-10 ${CELL}`}
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
              const hajiraGroupTone =
                hajiraDirtyTone === "text-amber-500"
                  ? "text-amber-500"
                  : "";
              const earn = dayEarnings(row, viewEarningsFilter);
              const showRet = showReturnAmount(row);
              const pendingCreate = isPendingCreateRow(row, initial, date);
              const rowSaveErrors =
                saveRowErrors[Number(row.labourId)] ??
                saveRowErrors[row.labourId] ??
                null;
              const hasSaveError = Boolean(
                rowSaveErrors && rowSaveErrors.length,
              );
              const sealed = recordSealedOf(row);
              const offSite = isLabourOffSite(row);
              const nameMutedClass = offSite ? "text-base-content/45" : "";
              const sealedContentClass = sealed ? "opacity-50" : "";
              const fill = cellFill({
                hasSaveError,
                pendingCreate,
                activityTone: row.activityTone,
                index,
              });
              const auditRowClass = activityToneClass(row.activityTone);
              const rowTitle = sealed
                ? messageForCode("record_sealed")
                : pendingCreate
                  ? "নতুন হাজিরা — নিশ্চিত করলে তৈরি হবে"
                  : offSite
                    ? "এই শ্রমিক আর এই সাইটে নেই"
                    : undefined;

              return (
                <Fragment key={row.labourId}>
                  <tr className={`bg-transparent ${auditRowClass}`}>
                    <td
                      rowSpan={2}
                      className={`align-middle text-center tabular-nums text-base-content/60 w-10 cursor-pointer ${CELL} ${fill}`}
                      onClick={() => {
                        if (selectMode && canChangeActivityLog) return;
                        openRecordModal(row);
                      }}
                      title={rowTitle}
                    >
                      <span
                        className={`inline-flex w-full items-center justify-center ${sealedContentClass || ""}`.trim()}
                      >
                        {selectMode && canChangeActivityLog ? (
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
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
                      rowSpan={2}
                      className={`align-middle w-8 px-0 ${CELL_PHOTO} ${fill}`}
                    >
                      <LabourIdentity
                        row={row}
                        offSite={offSite}
                        canOpen={canOpenLabourDetail(row)}
                        onDenied={showLabourDetailDenied}
                      >
                        <PersonAvatar
                          photo={row.labourPhoto}
                          name={row.labourName}
                          size="xs"
                          shape="square"
                          className="[&>div]:w-6 [&>div]:h-6"
                        />
                      </LabourIdentity>
                    </td>
                    <td
                      rowSpan={2}
                      className={`align-middle font-medium pl-1 min-w-0 ${CELL} ${fill} ${nameMutedClass}`}
                    >
                      <LabourIdentity
                        row={row}
                        offSite={offSite}
                        canOpen={canOpenLabourDetail(row)}
                        onDenied={showLabourDetailDenied}
                      >
                        <span className="link link-hover block min-w-0 leading-tight whitespace-normal wrap-break-word">
                          {row.labourName}
                        </span>
                      </LabourIdentity>
                    </td>
                    <td
                      className={`${VALUE_CELL} ${CELL_TOP_INNER} ${fill} ${hajiraGroupTone} ${sealedContentClass} cursor-pointer`}
                      onClick={() => openRecordModal(row)}
                      title={rowTitle}
                    >
                      <PresentTimesSalary
                        present={row.present}
                        salary={row.salary}
                        showSalary={showSalary}
                      />
                    </td>
                    <td
                      className={`${VALUE_CELL} ${CELL_TOP} ${fill} ${sealedContentClass} cursor-pointer ${paymentLineTone(
                        row,
                        initial,
                        ["payment", "paymentNote"],
                        "paymentId",
                        "text-error",
                      )}`}
                      onClick={() => openRecordModal(row)}
                      title={rowTitle}
                    >
                      <Amount value={row.payment} tone="text-error" />
                    </td>
                    {showAyColumn ? (
                      <td
                        rowSpan={2}
                        className={`${VALUE_CELL} ${CELL} ${fill} ${hajiraGroupTone} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                        title={rowTitle}
                      >
                        <span className={sealedContentClass || undefined}>
                          <Amount value={earn} />
                        </span>
                      </td>
                    ) : null}
                    {SHOW_BILLING ? (
                      <td
                        rowSpan={2}
                        className={`text-right align-middle text-xs whitespace-nowrap ${CELL} ${fill} cursor-pointer`}
                        title={
                          hasBilling(row) || recordIdOf(row)
                            ? billingFullLabelForRow(row)
                            : undefined
                        }
                        onClick={() => openRecordModal(row)}
                      >
                        <span className={sealedContentClass || undefined}>
                          {hasBilling(row) || recordIdOf(row)
                            ? billingLabelForRow(row)
                            : "—"}
                        </span>
                      </td>
                    ) : null}
                  </tr>
                  <tr className={`bg-transparent ${auditRowClass}`}>
                    <td
                      className={`${VALUE_CELL} ${CELL_SUB_INNER} ${fill} ${hajiraGroupTone} ${sealedContentClass} cursor-pointer`}
                      onClick={() => openRecordModal(row)}
                      title={rowTitle}
                    >
                      <Amount value={row.extra} tone="text-success" />
                    </td>
                    <td
                      className={`${VALUE_CELL} ${CELL_SUB} ${fill} ${sealedContentClass} cursor-pointer`}
                      onClick={() => openRecordModal(row)}
                      title={rowTitle}
                    >
                      <span className="block leading-tight">
                        <span
                          className={paymentLineTone(
                            row,
                            initial,
                            ["advance", "advanceNote"],
                            "paymentId",
                            "text-error",
                          )}
                        >
                          <Amount value={row.advance} tone="text-error" />
                        </span>
                        {showRet ? (
                          <span
                            className={`block ${paymentLineTone(
                              row,
                              initial,
                              ["return", "returnNote"],
                              "returnId",
                              "",
                            )}`}
                          >
                            <Amount value={row.return} />
                          </span>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                  {hasSaveError ? (
                    <tr className="bg-transparent">
                      <td
                        colSpan={tableColCount}
                        className={`py-1 text-xs text-error font-normal whitespace-normal leading-snug ${CELL} !bg-error/10`}
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
            <tr className="font-medium bg-transparent">
              <td rowSpan={2} className={`${CELL} ${FOOT_BG}`} />
              <td rowSpan={2} className={`w-8 px-0 ${CELL_PHOTO} ${FOOT_BG}`} />
              <td
                rowSpan={2}
                className={`align-middle whitespace-nowrap pl-1 ${CELL} ${FOOT_BG}`}
              >
                মোট
              </td>
              <td className={`${VALUE_CELL} ${CELL_TOP_INNER} ${FOOT_BG}`}>
                <PresentTimesSalary
                  present={totals.present}
                  salary={totals.salary}
                  showSalary={showSalary}
                />
              </td>
              <td className={`${VALUE_CELL} ${CELL_TOP} ${FOOT_BG}`}>
                <Amount value={totals.payment} tone="text-error" />
              </td>
              {showAyColumn ? (
                <td className={`${VALUE_CELL} ${CELL} ${FOOT_BG}`} rowSpan={2}>
                  <Amount value={totals.earnings} />
                </td>
              ) : null}
              {SHOW_BILLING ? (
                <td
                  rowSpan={2}
                  className={`text-right align-middle ${CELL} ${FOOT_BG}`}
                >
                  —
                </td>
              ) : null}
            </tr>
            <tr className="font-medium bg-transparent">
              <td className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_BG}`}>
                <Amount value={totals.extra} tone="text-success" />
              </td>
              <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_BG}`}>
                <Amount value={totals.advance} tone="text-error" />
              </td>
            </tr>
            <tr className="font-medium bg-transparent">
              <td className={`${CELL} ${FOOT_BG}`} />
              <td className={`w-8 px-0 ${CELL_PHOTO} ${FOOT_BG}`} />
              <td
                className={`align-middle whitespace-nowrap pl-1 ${CELL} ${FOOT_BG}`}
              >
                সর্বমোট
              </td>
              <td className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_BG}`}>
                <Amount value={num(totals.earnings)} tone="text-success" />
              </td>
              <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_BG}`}>
                <Amount value={takenOf(totals)} tone="text-error" />
              </td>
              {showAyColumn ? (
                <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_BG}`}>
                  <Amount value={num(totals.earnings)} tone="text-success" />
                </td>
              ) : null}
              {SHOW_BILLING ? (
                <td className={`text-right align-middle ${CELL} ${FOOT_BG}`}>
                  —
                </td>
              ) : null}
            </tr>
            <tr className="font-medium bg-transparent">
              <td className={`${CELL} ${FOOT_REMAIN_BG}`} />
              <td className={`w-8 px-0 ${CELL_PHOTO} ${FOOT_REMAIN_BG}`} />
              <td
                className={`align-middle whitespace-nowrap pl-1 ${signedTone(payableOf(totals))} ${CELL} ${FOOT_REMAIN_BG}`}
              >
                অবশিষ্ট
              </td>
              <td
                colSpan={2}
                className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_REMAIN_BG}`}
              >
                <Amount
                  value={payableOf(totals)}
                  tone={signedTone(payableOf(totals))}
                />
              </td>
              {showAyColumn ? (
                <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_REMAIN_BG}`}>
                  —
                </td>
              ) : null}
              {SHOW_BILLING ? (
                <td
                  className={`text-right align-middle ${CELL} ${FOOT_REMAIN_BG}`}
                >
                  —
                </td>
              ) : null}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function LabourIdentity({ row, offSite, canOpen, onDenied, children }) {
  const muted = offSite ? "text-base-content/45" : "";
  if (row.labourId != null && canOpen) {
    return (
      <Link
        to={paths.labourDetail(row.labourId)}
        className={["inline-flex items-center max-w-full", muted]
          .filter(Boolean)
          .join(" ")}
        title={offSite ? "এই শ্রমিক আর এই সাইটে নেই" : row.labourName}
      >
        {children}
      </Link>
    );
  }
  if (row.labourId != null) {
    return (
      <button
        type="button"
        className={[
          "inline-flex items-center max-w-full text-left cursor-pointer",
          "text-base-content/60",
          muted,
        ]
          .filter(Boolean)
          .join(" ")}
        title="এই শ্রমিকের সাইটে অনুমতি নেই"
        onClick={() => void onDenied(row)}
      >
        {children}
      </button>
    );
  }
  return (
    <span
      className={["inline-flex items-center max-w-full", muted]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
