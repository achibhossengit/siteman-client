import { Fragment } from "react";
import { Link } from "react-router-dom";
import { activityCellToneClass } from "../../api/types/activity.js";
import { messageForCode } from "../../api/errors.js";
import { PersonAvatar } from "../PersonAvatar.jsx";
import { SHOW_BILLING } from "../../config/features.js";
import { paths } from "../../router/paths.js";
import { formatBnNumber } from "../../utils/format.js";
import {
  FitAmount as Amount,
  JoinedAmounts,
  PresentLine,
  RETURN_TONE,
  remainTone,
  remainingOf,
  splitSettlement,
} from "./JoinedAmounts.jsx";
import {
  EARNINGS_DEFAULT_FIELDS,
  HAJIRA_MOT_DOYA_ROW_ID,
  HAJIRA_MOT_FEROT_ROW_ID,
  HAJIRA_SORBOMOT_DOYA_ID,
  HAJIRA_SORBOMOT_FEROT_ID,
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
  sessionPairClass,
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
const SORBOMOT_BG =
  "!bg-[color-mix(in_oklab,var(--color-base-300),var(--color-base-content)_6%)]";
const VALUE_CELL =
  "text-right align-middle tabular-nums whitespace-nowrap leading-none px-1 !py-px text-xs w-[1%] min-w-14 max-w-24";
const PAIR_COL = "w-[1%] min-w-14";

const num = (v) => Number(v) || 0;

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
  labourHeader,
  hajiraHeader,
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
  void viewPaymentFilter;
  void viewHajiraFields;
  void showReturnAmount;

  const pairRows = 3;
  const colCount = tableColCount;
  const row2Left = CELL_TOP_INNER;
  const row2Right = CELL_TOP;
  const remainTotal = remainingOf(totals);
  const footRows = pairRows + 1;
  return (
    <div className="flex-1 min-h-0 overflow-auto pb-24">
      <table className="table table-xs table-auto w-full bg-transparent text-xs border-separate border-spacing-0 border-t border-l border-base-content/35 [&_th]:!px-1 [&_th]:!py-2 sm:[&_th]:!py-3 [&_th]:bg-base-300 [&_td]:!px-0.5 [&_td]:!py-px [&_tbody_tr]:bg-transparent [&_tbody_td]:bg-transparent [&_tbody_tr:hover]:bg-transparent [&_tfoot_tr]:bg-transparent [&_tfoot_td]:bg-transparent">
        <colgroup>
          <col className="w-10" />
          <col className="w-8" />
          <col />
          <col className={PAIR_COL} />
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
              {labourHeader}
            </th>
            <th
              colSpan={2}
              className={`text-center align-middle font-medium ${CELL} ${HEAD_BG}`}
            >
              {hajiraHeader}
            </th>
            <th
              className={`text-center align-middle font-medium ${CELL} ${SORBOMOT_BG}`}
            >
              সর্বমোট
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
                colSpan={colCount}
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
              const pendingCreate = isPendingCreateRow(row, initial, date);
              const { paid: settlePaid, back: settleBack } = splitSettlement(
                row.settlement,
              );
              const rowSaveErrors =
                saveRowErrors[Number(row.labourId)] ??
                saveRowErrors[row.labourId] ??
                null;
              const hasSaveError = Boolean(
                rowSaveErrors && rowSaveErrors.length,
              );
              const sealed = recordSealedOf(row);
              const advanceTone = paymentLineTone(
                row,
                initial,
                ["advance", "advanceNote"],
                "paymentId",
                "text-error",
              );
              const returnTone = paymentLineTone(
                row,
                initial,
                ["return", "returnNote"],
                "returnId",
                RETURN_TONE,
              );
              const offSite = isLabourOffSite(row);
              const nameMutedClass = offSite ? "text-base-content/45" : "";
              const sealedContentClass = sealed ? "opacity-50" : "";
              const fill = cellFill({
                hasSaveError,
                pendingCreate,
                activityTone: row.activityTone,
                index,
              });
              const hasSession = settlePaid !== 0 || settleBack !== 0;
              const rowTitle = sealed
                ? messageForCode("record_sealed")
                : pendingCreate
                  ? "নতুন হাজিরা — নিশ্চিত করলে তৈরি হবে"
                  : offSite
                    ? "এই শ্রমিক আর এই সাইটে নেই"
                    : undefined;

              return (
                <Fragment key={row.labourId}>
                  <tr className="bg-transparent">
                    <td
                      rowSpan={pairRows}
                      className={`align-middle text-center tabular-nums text-base-content/60 w-10 ${CELL} ${fill}`}
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
                      rowSpan={pairRows}
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
                      rowSpan={pairRows}
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
                      className={`${VALUE_CELL} ${CELL_TOP_INNER} ${fill} ${sessionPairClass(hasSession, "top", "left")} ${hajiraGroupTone} ${sealedContentClass} cursor-pointer`}
                      onClick={() => openRecordModal(row)}
                      title={rowTitle}
                    >
                      <PresentLine
                        present={row.present}
                        salary={row.salary}
                        showSalary={showSalary}
                      />
                    </td>
                    <td
                      className={`${VALUE_CELL} ${CELL_TOP} ${fill} ${sessionPairClass(hasSession, "top", "right")} ${hajiraGroupTone} ${sealedContentClass} cursor-pointer`}
                      onClick={() => openRecordModal(row)}
                      title={rowTitle}
                    >
                      <Amount
                        value={row.extra}
                        tone={hajiraGroupTone || "text-success"}
                      />
                    </td>
                    <td
                      className={`${VALUE_CELL} ${CELL_TOP} ${SORBOMOT_BG} ${sealedContentClass}`}
                      title={rowTitle}
                    >
                      <Amount value={earn} tone="text-success" />
                    </td>
                    {showAyColumn ? (
                      <td
                        rowSpan={pairRows}
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
                        rowSpan={pairRows}
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
                  <tr className="bg-transparent">
                    <td
                      className={`${VALUE_CELL} ${row2Left} ${fill} ${sessionPairClass(hasSession, "mid", "left")} ${sealedContentClass} cursor-pointer ${paymentLineTone(
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
                    <td
                      className={`${VALUE_CELL} ${row2Right} ${fill} ${sessionPairClass(hasSession, "mid", "right")} ${sealedContentClass} cursor-pointer`}
                      onClick={() => openRecordModal(row)}
                      title={
                        settlePaid ? "হিসাবের সময় দেওয়া হয়েছে" : rowTitle
                      }
                    >
                      <JoinedAmounts
                        tone={advanceTone}
                        parts={[
                          { value: row.advance },
                          { value: settlePaid },
                        ]}
                      />
                    </td>
                    <td
                      className={`${VALUE_CELL} ${row2Right} ${SORBOMOT_BG} ${sealedContentClass}`}
                      title={rowTitle}
                    >
                      <Amount
                        value={
                          num(row.payment) + num(row.advance) + settlePaid
                        }
                        tone="text-error"
                      />
                    </td>
                  </tr>
                  <tr className="bg-transparent">
                      <td
                        className={`${VALUE_CELL} ${CELL_SUB_INNER} ${fill} ${sessionPairClass(hasSession, "bot", "left")} ${sealedContentClass} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                        title={rowTitle}
                      >
                        <Amount value={row.return} tone={returnTone} />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${CELL_SUB} ${fill} ${sessionPairClass(hasSession, "bot", "right")} ${sealedContentClass} cursor-pointer`}
                        onClick={() => openRecordModal(row)}
                        title={
                          settleBack
                            ? "হিসাবের সময় ফেরত নেওয়া হয়েছে"
                            : rowTitle
                        }
                      >
                        <Amount value={settleBack} tone={RETURN_TONE} />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG} ${sealedContentClass}`}
                        title={rowTitle}
                      >
                        <Amount
                          value={num(row.return) + settleBack}
                          tone={RETURN_TONE}
                        />
                      </td>
                    </tr>
                  {hasSaveError ? (
                    <tr className="bg-transparent">
                      <td
                        colSpan={colCount}
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
              <td
                colSpan={3}
                className={`align-middle text-right whitespace-nowrap pr-1 ${CELL} ${FOOT_BG}`}
              >
                মোট উপার্জন
              </td>
              <td
                className={`${VALUE_CELL} ${CELL_TOP_INNER} ${FOOT_BG} !align-baseline`}
              >
                <Amount value={totals.present} />
              </td>
              <td
                className={`${VALUE_CELL} ${CELL_TOP} ${FOOT_BG} !align-baseline`}
              >
                <Amount value={totals.extra} tone="text-success" />
              </td>
              <td
                className={`${VALUE_CELL} ${CELL_TOP} ${SORBOMOT_BG} !align-baseline`}
              >
                <Amount value={totals.earnings} tone="text-success" />
              </td>
              {showAyColumn ? (
                <td
                  className={`${VALUE_CELL} ${CELL} ${FOOT_BG}`}
                  rowSpan={footRows}
                >
                  <Amount value={totals.earnings} />
                </td>
              ) : null}
              {SHOW_BILLING ? (
                <td
                  rowSpan={footRows}
                  className={`text-right align-middle ${CELL} ${FOOT_BG}`}
                >
                  —
                </td>
              ) : null}
            </tr>
            <tr id={HAJIRA_MOT_DOYA_ROW_ID} className="font-medium bg-transparent">
              <td
                colSpan={3}
                className={`align-middle text-right whitespace-nowrap pr-1 ${CELL} ${FOOT_BG}`}
              >
                মোট দেওয়া
              </td>
              <td className={`${VALUE_CELL} ${row2Left} ${FOOT_BG}`}>
                <Amount value={totals.payment} tone="text-error" />
              </td>
              <td className={`${VALUE_CELL} ${row2Right} ${FOOT_BG}`}>
                <JoinedAmounts
                  tone="text-error"
                  parts={[
                    { value: totals.advance },
                    { value: splitSettlement(totals.settlement).paid },
                  ]}
                />
              </td>
              <td
                id={HAJIRA_SORBOMOT_DOYA_ID}
                className={`${VALUE_CELL} ${row2Right} ${SORBOMOT_BG}`}
              >
                <Amount
                  value={
                    num(totals.payment) +
                    num(totals.advance) +
                    splitSettlement(totals.settlement).paid
                  }
                  tone="text-error"
                />
              </td>
            </tr>
            <tr id={HAJIRA_MOT_FEROT_ROW_ID} className="font-medium bg-transparent">
                <td
                  colSpan={3}
                  className={`align-middle text-right whitespace-nowrap pr-1 ${CELL} ${FOOT_BG}`}
                >
                  মোট ফেরত
                </td>
                <td className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_BG}`}>
                  <Amount value={totals.return} tone={RETURN_TONE} />
                </td>
                <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_BG}`}>
                  <Amount
                    value={splitSettlement(totals.settlement).back}
                    tone={RETURN_TONE}
                  />
                </td>
                <td
                  id={HAJIRA_SORBOMOT_FEROT_ID}
                  className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}
                >
                  <Amount
                    value={
                      num(totals.return) +
                      splitSettlement(totals.settlement).back
                    }
                    tone={RETURN_TONE}
                  />
                </td>
              </tr>
            <tr className="font-medium bg-transparent">
              <td
                colSpan={3}
                className={`align-middle text-right whitespace-nowrap pr-1 ${CELL} ${SORBOMOT_BG}`}
              >
                পাওনা
              </td>
              <td
                colSpan={3}
                className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}
              >
                <Amount
                  value={remainTotal}
                  tone={remainTone(remainTotal)}
                />
              </td>
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
