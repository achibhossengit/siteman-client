import { Fragment } from "react";
import { Link } from "react-router-dom";
import { PersonAvatar } from "../PersonAvatar.jsx";
import { paths } from "../../router/paths.js";
import { concatLabourName, formatBnNumber } from "../../utils/format.js";
import { formatDateColBn } from "../../utils/dateRange.js";
import { filterHeaderTitle } from "./helpers.js";
import {
  JoinedAmounts,
  PresentEarningsTotal,
  RETURN_TONE,
  SETTLEMENT_TONE,
  splitSettlement,
} from "./JoinedAmounts.jsx";
import { LABOUR_DEFAULT_FIELDS } from "./constants.js";

const BORDER_Y = "border-b border-b-base-content/35";
const BORDER_Y_SOFT = "border-b border-b-base-content/15";
const BORDER_X = "border-r border-r-base-content/35";
const BORDER_X_INNER = "border-r border-r-base-content/15";
const CELL = `${BORDER_Y} ${BORDER_X}`;
const CELL_TOP = `${BORDER_Y_SOFT} ${BORDER_X}`;
const CELL_TOP_INNER = `${BORDER_Y_SOFT} ${BORDER_X_INNER}`;
const CELL_SUB = `${BORDER_Y} ${BORDER_X}`;
const CELL_SUB_INNER = `${BORDER_Y} ${BORDER_X_INNER}`;
const CELL_PIN = BORDER_Y;
const STICKY_PIN = "sticky left-0 z-[2]";
const STICKY_PIN_FOOT = "sticky left-0 z-[3]";
const HEAD_BG = "!bg-base-300";
const STICKY_PIN_HEAD = `sticky left-0 z-20 ${HEAD_BG}`;
const ROW_EVEN = "!bg-base-100";
const ROW_ODD = "!bg-base-200";
const FOOT_GRAY_BG = "!bg-base-300";
const FOOT_REMAIN_BG = FOOT_GRAY_BG;
const VALUE_CELL =
  "text-right align-middle tabular-nums whitespace-nowrap leading-tight min-w-9 w-9 px-0.5 text-xs";

const rowBg = (index) => (index % 2 === 0 ? ROW_EVEN : ROW_ODD);

const num = (v) => Number(v) || 0;

// taken = khoraki + advance + session settlement (or API-provided `taken`)
const takenOf = (obj) =>
  obj?.taken != null
    ? num(obj.taken)
    : num(obj?.khoraki) + num(obj?.advance) + num(obj?.settlement);

// payable = API-provided `payable`, else earnings - taken
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

export function HajiraRangeTable({
  dates,
  showDayColumns,
  rows,
  emptyMessage,
  footer,
  openLabourFilterModal,
  labourFilter,
  isLabourOffSite,
  canOpenLabourDetail,
  canCreateDay,
  onOpenDay,
  showLabourDetailDenied,
}) {
  const dayCount = showDayColumns ? dates.length : 0;
  const colCount = 3 + dayCount * 2 + 2;

  // Per-date earnings = Σ (present × salary + extra). Payable = earnings − taken.
  const totalEarnings = num(footer?.totals?.earnings);
  const footerDayExtra = (footer?.byDate ?? []).reduce(
    (sum, d) => sum + num(d.extra),
    0,
  );
  const totalTaken = takenOf(footer?.totals);
  const totalPayable = payableOf(footer?.totals);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {!showDayColumns ? (
        <p className="text-xs text-base-content/60 px-3 py-1.5 shrink-0">
          এক মাসের বেশি সময়ে শুধু মোট দেখানো হচ্ছে।
        </p>
      ) : null}
      <div className="flex-1 min-h-0 overflow-auto pb-8">
        <table className="table table-xs w-max bg-transparent text-xs border-separate border-spacing-0 border-t border-l border-base-content/35 [&_th]:!px-1 [&_th]:!py-2 sm:[&_th]:!py-3 [&_th]:!bg-base-300 [&_td]:!px-0.5 [&_td]:!py-1 [&_tbody_tr]:bg-transparent [&_tbody_td]:bg-transparent [&_tbody_tr:hover]:bg-transparent [&_tfoot_tr]:bg-transparent [&_tfoot_td]:bg-transparent">
          <thead className={`sticky top-0 z-10 ${HEAD_BG}`}>
            <tr>
              <th className={`w-7 align-middle ${CELL} ${HEAD_BG}`}>নং</th>
              <th className={`w-7 px-0 ${CELL_PIN} ${HEAD_BG}`} />
              <th
                className={`w-20 max-w-20 sm:w-28 sm:max-w-28 pl-1 align-middle ${CELL} ${STICKY_PIN_HEAD}`}
              >
                <button type="button" onClick={openLabourFilterModal}>
                  {filterHeaderTitle("নাম", labourFilter, LABOUR_DEFAULT_FIELDS)}
                </button>
              </th>
              {showDayColumns
                ? dates.map((iso) => (
                    <th
                      key={iso}
                      colSpan={2}
                      className={`text-center align-middle font-medium whitespace-nowrap px-0.5 ${CELL} ${HEAD_BG}`}
                    >
                      {formatDateColBn(iso)}
                    </th>
                  ))
                : null}
              <th
                colSpan={2}
                className={`text-center align-middle font-medium ${CELL} ${HEAD_BG}`}
              >
                মোট
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className={`text-center text-sm text-base-content/60 !py-10 ${CELL}`}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const offSite = isLabourOffSite(row);
                const stripe = rowBg(index);
                return (
                  <Fragment key={row.labourId}>
                    <tr className="bg-transparent">
                      <td
                        rowSpan={2}
                        className={`align-middle tabular-nums text-base-content/60 w-7 ${CELL} ${stripe}`}
                      >
                        {formatBnNumber(index + 1)}
                      </td>
                      <td
                        rowSpan={2}
                        className={`align-middle w-7 px-0 ${CELL_PIN} ${stripe}`}
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
                        className={`align-middle font-medium pl-1 w-20 max-w-20 sm:w-28 sm:max-w-28 ${CELL} ${STICKY_PIN} ${stripe}`}
                      >
                        <LabourIdentity
                          row={row}
                          offSite={offSite}
                          canOpen={canOpenLabourDetail(row)}
                          onDenied={showLabourDetailDenied}
                        >
                          <span className="link link-hover block min-w-0 truncate">
                            {concatLabourName(row.labourName)}
                          </span>
                        </LabourIdentity>
                      </td>
                      {showDayColumns
                        ? row.days.map((day) => (
                            <DayPair
                              key={day.date}
                              band="top"
                              day={day}
                              rowBg={stripe}
                              canCreateDay={canCreateDay}
                              onOpen={() => onOpenDay(row, day)}
                            />
                          ))
                        : null}
                      <td className={`${VALUE_CELL} ${CELL_TOP_INNER} ${stripe}`}>
                        <PresentEarningsTotal
                          present={row.totals.present}
                          earnings={
                            showDayColumns
                              ? row.days.reduce(
                                  (sum, d) =>
                                    sum + num(d.earnings) - num(d.extra),
                                  0,
                                )
                              : null
                          }
                          extra={row.totals.extra}
                        />
                      </td>
                      <td className={`${VALUE_CELL} ${CELL_TOP} ${stripe}`}>
                        <Amount value={row.totals.khoraki} tone="text-error" />
                      </td>
                    </tr>
                    <tr className="bg-transparent">
                      {showDayColumns
                        ? row.days.map((day) => (
                            <DayPair
                              key={`${day.date}-sub`}
                              band="sub"
                              day={day}
                              rowBg={stripe}
                              canCreateDay={canCreateDay}
                              onOpen={() => onOpenDay(row, day)}
                            />
                          ))
                        : null}
                      <td
                        className={`${VALUE_CELL} ${CELL_SUB_INNER} ${num(row.totals.settlement) !== 0 ? "!bg-info/15" : stripe}`}
                      >
                        <JoinedAmounts
                          parts={[
                            { value: row.totals.returned, tone: RETURN_TONE },
                            {
                              value: splitSettlement(row.totals.settlement).back,
                              tone: SETTLEMENT_TONE,
                            },
                          ]}
                        />
                      </td>
                      <td
                        className={`${VALUE_CELL} ${CELL_SUB} ${num(row.totals.settlement) !== 0 ? "!bg-info/15" : stripe}`}
                      >
                        <JoinedAmounts
                          parts={[
                            { value: row.totals.advance, tone: "text-error" },
                            {
                              value: splitSettlement(row.totals.settlement).paid,
                              tone: SETTLEMENT_TONE,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="font-medium bg-transparent">
                <td rowSpan={2} className={`${CELL} ${FOOT_GRAY_BG}`} />
                <td
                  rowSpan={2}
                  className={`w-7 px-0 ${CELL_PIN} ${FOOT_GRAY_BG}`}
                />
                <td
                  rowSpan={2}
                  className={`align-middle whitespace-nowrap pl-1 ${CELL} ${STICKY_PIN_FOOT} ${FOOT_GRAY_BG}`}
                >
                  মোট
                </td>
                {showDayColumns
                  ? footer.byDate.map((day) => (
                      <DayPair
                        key={`foot-${day.date}`}
                        band="top"
                        total
                        day={day}
                        rowBg={FOOT_GRAY_BG}
                      />
                    ))
                  : null}
                <td
                  className={`${VALUE_CELL} ${CELL_TOP_INNER} ${FOOT_GRAY_BG} !align-baseline`}
                >
                  <PresentEarningsTotal
                    present={footer.totals.present}
                    earnings={
                      showDayColumns
                        ? totalEarnings - footerDayExtra
                        : null
                    }
                    extra={footer.totals.extra}
                    stacked
                  />
                </td>
                <td
                  className={`${VALUE_CELL} ${CELL_TOP} ${FOOT_GRAY_BG} !align-baseline`}
                >
                  <Amount value={footer.totals.khoraki} tone="text-error" />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                {showDayColumns
                  ? footer.byDate.map((day) => (
                      <DayPair
                        key={`foot-${day.date}-sub`}
                        band="sub"
                        total
                        day={day}
                        rowBg={FOOT_GRAY_BG}
                      />
                    ))
                  : null}
                <td
                  className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_GRAY_BG}`}
                >
                  <JoinedAmounts
                    parts={[
                      { value: footer.totals.returned, tone: RETURN_TONE },
                      {
                        value: splitSettlement(footer.totals.settlement).back,
                        tone: SETTLEMENT_TONE,
                      },
                    ]}
                  />
                </td>
                <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_GRAY_BG}`}>
                  <JoinedAmounts
                    parts={[
                      { value: footer.totals.advance, tone: "text-error" },
                      {
                        value: splitSettlement(footer.totals.settlement).paid,
                        tone: SETTLEMENT_TONE,
                      },
                    ]}
                  />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                <td className={`${CELL} ${FOOT_GRAY_BG}`} />
                <td className={`w-7 px-0 ${CELL_PIN} ${FOOT_GRAY_BG}`} />
                <td
                  className={`align-middle whitespace-nowrap pl-1 ${CELL} ${STICKY_PIN_FOOT} ${FOOT_GRAY_BG}`}
                >
                  সর্বমোট
                </td>
                {showDayColumns
                  ? footer.byDate.map((day) => (
                      <Fragment key={`foot-${day.date}-sum`}>
                        <td
                          className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_GRAY_BG}`}
                        >
                          <Amount
                            value={num(day?.earnings)}
                            tone="text-success"
                          />
                        </td>
                        <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_GRAY_BG}`}>
                          <Amount value={takenOf(day)} tone="text-error" />
                        </td>
                      </Fragment>
                    ))
                  : null}
                <td className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_GRAY_BG}`}>
                  <Amount value={totalEarnings} tone="text-success" />
                </td>
                <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_GRAY_BG}`}>
                  <Amount value={totalTaken} tone="text-error" />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                <td className={`${CELL} ${FOOT_REMAIN_BG}`} />
                <td className={`w-7 px-0 ${CELL_PIN} ${FOOT_REMAIN_BG}`} />
                <td
                  className={`align-middle whitespace-nowrap pl-1 ${signedTone(totalPayable)} ${CELL} ${STICKY_PIN_FOOT} ${FOOT_REMAIN_BG}`}
                >
                  অবশিষ্ট
                </td>
                {showDayColumns
                  ? footer.byDate.map((day) => (
                      <td
                        key={`foot-${day.date}-payable`}
                        colSpan={2}
                        className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_REMAIN_BG}`}
                      >
                        <Amount
                          value={payableOf(day)}
                          tone={signedTone(payableOf(day))}
                        />
                      </td>
                    ))
                  : null}
                <td
                  colSpan={2}
                  className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_REMAIN_BG}`}
                >
                  <Amount value={totalPayable} tone={signedTone(totalPayable)} />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function DayPair({ day, band, total, rowBg: stripe, canCreateDay, onOpen }) {
  const sub = band === "sub";
  const clickable = Boolean(onOpen) && (Boolean(day.record) || Boolean(canCreateDay));
  const title = clickable
    ? day.record
      ? undefined
      : "নতুন হাজিরা"
    : undefined;
  const open = clickable ? onOpen : undefined;
  const leftClass = sub ? CELL_SUB_INNER : CELL_TOP_INNER;
  const rightClass = sub ? CELL_SUB : CELL_TOP;
  const { paid, back } = splitSettlement(day.settlement);
  // Settled days get a tinted bottom pair (settlement merges into it).
  const settled = !total && sub && (paid !== 0 || back !== 0);
  const cellClass = [
    VALUE_CELL,
    settled ? "!bg-info/15" : stripe,
    clickable ? "cursor-pointer" : "",
    total && !sub ? "!align-baseline" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <td
        className={[cellClass, leftClass].join(" ")}
        onClick={open}
        title={title}
      >
        {sub ? (
          <JoinedAmounts
            parts={[
              { value: day.returned, tone: RETURN_TONE },
              { value: back, tone: SETTLEMENT_TONE },
            ]}
          />
        ) : total ? (
          <PresentEarningsTotal
            present={day.present}
            earnings={num(day.earnings) - num(day.extra)}
            extra={day.extra}
            stacked
          />
        ) : (
          <JoinedAmounts
            parts={[
              { value: day.present, tone: "" },
              { value: day.extra, tone: "text-success" },
            ]}
          />
        )}
      </td>
      <td
        className={[cellClass, rightClass].join(" ")}
        onClick={open}
        title={title}
      >
        {sub ? (
          <JoinedAmounts
            parts={[
              { value: day.advance, tone: "text-error" },
              { value: paid, tone: SETTLEMENT_TONE },
            ]}
          />
        ) : (
          <Amount value={day.khoraki} tone="text-error" />
        )}
      </td>
    </>
  );
}

function LabourIdentity({ row, offSite, canOpen, onDenied, children }) {
  const muted = offSite ? "text-base-content/45" : "";
  if (row.labourId != null && canOpen) {
    return (
      <Link
        to={paths.labourDetail(row.labourId)}
        className={["flex items-center w-full min-w-0 overflow-hidden", muted]
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
          "flex items-center w-full min-w-0 overflow-hidden text-left cursor-pointer",
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
      className={["flex items-center w-full min-w-0 overflow-hidden", muted]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}