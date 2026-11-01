import { Fragment } from "react";
import { Link } from "react-router-dom";
import { PersonAvatar } from "../PersonAvatar.jsx";
import { paths } from "../../router/paths.js";
import { concatLabourName, formatBnNumber } from "../../utils/format.js";
import { formatDateColBn } from "../../utils/dateRange.js";
import { sessionPairClass } from "./helpers.js";
import {
  FitAmount as Amount,
  JoinedAmounts,
  PresentLine,
  RETURN_TONE,
  remainTone,
  remainingOf,
  settlementSides,
} from "./JoinedAmounts.jsx";
import {
  HAJIRA_MOT_DOYA_ROW_ID,
  HAJIRA_MOT_FEROT_ROW_ID,
  HAJIRA_SORBOMOT_DOYA_ID,
  HAJIRA_SORBOMOT_FEROT_ID,
} from "./constants.js";

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
const ROW_EVEN = "!bg-base-100";
const ROW_ODD = "!bg-base-200";
const FOOT_GRAY_BG = "!bg-base-300";
const MOT_COL_BG = FOOT_GRAY_BG;
const SORBOMOT_BG =
  "!bg-[color-mix(in_oklab,var(--color-base-300),var(--color-base-content)_6%)]";
const HEAD_BG = SORBOMOT_BG;
const STICKY_PIN_HEAD = `sticky left-0 z-20 ${HEAD_BG}`;
/** Full labour band ≈ one cash row; 3 subrows share it. */
const BAND_H = "h-10 sm:h-12";
const SUB_H = "!h-[calc(2.5rem/3)] sm:!h-4 !py-0";
const VALUE_CELL =
  `text-right align-middle tabular-nums whitespace-nowrap leading-none min-w-10 max-w-20 px-0.5 text-xs ${SUB_H}`;

const rowBg = (index) => (index % 2 === 0 ? ROW_EVEN : ROW_ODD);

const num = (v) => Number(v) || 0;

export function HajiraRangeTable({
  dates,
  showDayColumns,
  rows,
  emptyMessage,
  footer,
  labourHeader,
  showSalary,
  isLabourOffSite,
  canOpenLabourDetail,
  canCreateDay,
  onOpenDay,
  showLabourDetailDenied,
}) {
  const pairRows = 3;
  const colCount = 3 + (showDayColumns ? dates.length * 2 : 0) + 3;
  const row2Left = CELL_TOP_INNER;
  const row2Right = CELL_TOP;
  const remainTotal = remainingOf(footer?.totals);
  const nameColClass = showDayColumns
    ? "w-20 max-w-20 sm:w-28 sm:max-w-28"
    : "min-w-0";
  const tableWidthClass = showDayColumns ? "w-max" : "table-auto w-full";

  // Per-date earnings = Σ (present × salary + extra). Payable = earnings − taken.
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {!showDayColumns ? (
        <p className="text-xs text-base-content/60 px-3 py-1.5 shrink-0">
          এক মাসের বেশি সময়ে শুধু মোট দেখানো হচ্ছে।
        </p>
      ) : null}
      <div className="flex-1 min-h-0 overflow-auto pb-8">
        <table
          className={`table table-xs ${tableWidthClass} bg-transparent text-xs border-separate border-spacing-0 border-t border-l border-base-content/35 [&_th]:!px-1 [&_th]:!py-1 sm:[&_th]:!py-1.5 [&_td]:!px-0.5 [&_tbody_tr]:bg-transparent [&_tbody_td]:bg-transparent [&_tbody_tr:hover]:bg-transparent [&_tfoot_tr]:bg-transparent [&_tfoot_td]:bg-transparent`}
        >
          {!showDayColumns ? (
            <colgroup>
              <col className="w-7" />
              <col className="w-7" />
              <col />
              <col className="w-[1%] min-w-14" />
              <col className="w-[1%] min-w-14" />
              <col className="w-[1%] min-w-14" />
            </colgroup>
          ) : null}
          <thead className={`sticky top-0 z-10 ${HEAD_BG}`}>
            <tr>
              <th className={`w-7 align-middle ${CELL} ${HEAD_BG}`}>নং</th>
              <th className={`w-7 px-0 ${CELL_PIN} ${HEAD_BG}`} />
              <th
                className={`${nameColClass} pl-1 align-middle ${CELL} ${STICKY_PIN_HEAD}`}
              >
                {labourHeader}
              </th>
              {showDayColumns
                ? dates.map((iso, i) => (
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
              <th
                className={`text-center align-middle font-medium ${CELL} ${SORBOMOT_BG}`}
              >
                সর্বমোট
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
                const motFill = MOT_COL_BG;
                const sorboFill = SORBOMOT_BG;
                return (
                  <Fragment key={row.labourId}>
                    <tr className="bg-transparent">
                      <td
                        rowSpan={pairRows}
                        className={`align-middle tabular-nums text-base-content/60 w-7 ${BAND_H} ${CELL} ${stripe}`}
                      >
                        {formatBnNumber(index + 1)}
                      </td>
                      <td
                        rowSpan={pairRows}
                        className={`align-middle w-7 px-0 ${BAND_H} ${CELL_PIN} ${stripe}`}
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
                            className="[&>div]:w-5 [&>div]:h-5"
                          />
                        </LabourIdentity>
                      </td>
                      <td
                        rowSpan={pairRows}
                        className={`align-middle font-medium pl-1 ${nameColClass} ${BAND_H} ${CELL} ${STICKY_PIN} ${stripe}`}
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
                        ? row.days.map((day, dayIdx) => (
                            <DayPair
                              key={day.date}
                              band="top"
                              day={day}
                              rowBg={stripe}
                              showSalary={showSalary}
                              lastBand={false}
                              canCreateDay={canCreateDay}
                              onOpen={() => onOpenDay(row, day)}
                            />
                          ))
                        : null}
                      <td className={`${VALUE_CELL} ${CELL_TOP_INNER} ${motFill}`}>
                        <Amount value={row.totals.present} />
                      </td>
                      <td className={`${VALUE_CELL} ${CELL_TOP} ${motFill}`}>
                        <Amount value={row.totals.extra} tone="text-success" />
                      </td>
                      <td className={`${VALUE_CELL} ${CELL_TOP} ${sorboFill}`}>
                        <Amount
                          value={
                            showDayColumns
                              ? row.days.reduce(
                                  (sum, d) => sum + num(d.earnings),
                                  0,
                                )
                              : num(row.totals.earnings)
                          }
                          tone="text-success"
                        />
                      </td>
                    </tr>
                    <tr className="bg-transparent">
                      {showDayColumns
                        ? row.days.map((day) => (
                            <DayPair
                              key={`${day.date}-mid`}
                              band="mid"
                              day={day}
                              rowBg={stripe}
                              lastBand={false}
                              canCreateDay={canCreateDay}
                              onOpen={() => onOpenDay(row, day)}
                            />
                          ))
                        : null}
                      <td className={`${VALUE_CELL} ${row2Left} ${motFill}`}>
                        <Amount value={row.totals.khoraki} tone="text-error" />
                      </td>
                      <td className={`${VALUE_CELL} ${row2Right} ${motFill}`}>
                        <Amount
                          value={
                            num(row.totals.advance) +
                            settlementSides(row.totals).paid
                          }
                          tone="text-error"
                        />
                      </td>
                      <td className={`${VALUE_CELL} ${row2Right} ${sorboFill}`}>
                        <Amount
                          value={
                            num(row.totals.khoraki) +
                            num(row.totals.advance) +
                            settlementSides(row.totals).paid
                          }
                          tone="text-error"
                        />
                      </td>
                    </tr>
                    <tr className="bg-transparent">
                        {showDayColumns
                          ? row.days.map((day) => (
                              <DayPair
                                key={`${day.date}-bot`}
                                band="bot"
                                day={day}
                                rowBg={stripe}
                                lastBand
                                canCreateDay={canCreateDay}
                                onOpen={() => onOpenDay(row, day)}
                              />
                            ))
                          : null}
                        <td
                          className={`${VALUE_CELL} ${CELL_SUB_INNER} ${motFill}`}
                        >
                          <Amount
                            value={row.totals.returned}
                            tone={RETURN_TONE}
                          />
                        </td>
                        <td
                          className={`${VALUE_CELL} ${CELL_SUB} ${motFill}`}
                        >
                          <Amount
                            value={settlementSides(row.totals).back}
                            tone={RETURN_TONE}
                          />
                        </td>
                        <td
                          className={`${VALUE_CELL} ${CELL_SUB} ${sorboFill}`}
                        >
                          <Amount
                            value={
                              num(row.totals.returned) +
                              settlementSides(row.totals).back
                            }
                            tone={RETURN_TONE}
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
                <FootTitle lastBand={false}>মোট উপার্জন</FootTitle>
                {showDayColumns
                  ? footer.byDate.map((day) => (
                      <DayPair
                        key={`foot-${day.date}`}
                        band="top"
                        total
                        lastBand={false}
                        day={day}
                        rowBg={FOOT_GRAY_BG}
                      />
                    ))
                  : null}
                <td
                  className={`${VALUE_CELL} ${CELL_TOP_INNER} ${FOOT_GRAY_BG} !align-baseline`}
                >
                  <Amount value={footer.totals.present} />
                </td>
                <td
                  className={`${VALUE_CELL} ${CELL_TOP} ${FOOT_GRAY_BG} !align-baseline`}
                >
                  <Amount value={footer.totals.extra} tone="text-success" />
                </td>
                <td
                  className={`${VALUE_CELL} ${CELL_TOP} ${SORBOMOT_BG} !align-baseline`}
                >
                  <Amount
                    value={num(footer.totals.earnings)}
                    tone="text-success"
                  />
                </td>
              </tr>
              <tr id={HAJIRA_MOT_DOYA_ROW_ID} className="font-medium bg-transparent">
                <FootTitle lastBand={false}>মোট দেওয়া</FootTitle>
                {showDayColumns
                  ? footer.byDate.map((day) => (
                      <DayPair
                        key={`foot-${day.date}-mid`}
                        band="mid"
                        total
                        lastBand={false}
                        day={day}
                        rowBg={FOOT_GRAY_BG}
                      />
                    ))
                  : null}
                <td className={`${VALUE_CELL} ${row2Left} ${FOOT_GRAY_BG}`}>
                  <Amount value={footer.totals.khoraki} tone="text-error" />
                </td>
                <td className={`${VALUE_CELL} ${row2Right} ${FOOT_GRAY_BG}`}>
                  <Amount
                    value={
                      num(footer.totals.advance) +
                      settlementSides(footer.totals).paid
                    }
                    tone="text-error"
                  />
                </td>
                <td
                  id={HAJIRA_SORBOMOT_DOYA_ID}
                  className={`${VALUE_CELL} ${row2Right} ${SORBOMOT_BG}`}
                >
                  <Amount
                    value={
                      num(footer.totals.khoraki) +
                      num(footer.totals.advance) +
                      settlementSides(footer.totals).paid
                    }
                    tone="text-error"
                  />
                </td>
              </tr>
              <tr id={HAJIRA_MOT_FEROT_ROW_ID} className="font-medium bg-transparent">
                  <FootTitle lastBand>মোট ফেরত</FootTitle>
                  {showDayColumns
                    ? footer.byDate.map((day) => (
                        <DayPair
                          key={`foot-${day.date}-bot`}
                          band="bot"
                          total
                          lastBand
                          day={day}
                          rowBg={FOOT_GRAY_BG}
                        />
                      ))
                    : null}
                  <td
                    className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_GRAY_BG}`}
                  >
                    <Amount
                      value={footer.totals.returned}
                      tone={RETURN_TONE}
                    />
                  </td>
                  <td
                    className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_GRAY_BG}`}
                  >
                    <Amount
                      value={settlementSides(footer.totals).back}
                      tone={RETURN_TONE}
                    />
                  </td>
                  <td
                    id={HAJIRA_SORBOMOT_FEROT_ID}
                    className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}
                  >
                    <Amount
                      value={
                        num(footer.totals.returned) +
                        settlementSides(footer.totals).back
                      }
                      tone={RETURN_TONE}
                    />
                  </td>
                </tr>
              <tr className="font-medium bg-transparent">
                <FootTitle lastBand bg={SORBOMOT_BG}>
                  পাওনা
                </FootTitle>
                {showDayColumns
                  ? footer.byDate.map((day) => {
                      const remain = remainingOf(day);
                      return (
                        <td
                          key={`foot-${day.date}-remain`}
                          colSpan={2}
                          className={`${VALUE_CELL} ${CELL_SUB} ${SORBOMOT_BG}`}
                        >
                          <Amount value={remain} tone={remainTone(remain)} />
                        </td>
                      );
                    })
                  : null}
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
    </div>
  );
}

function FootTitle({ children, lastBand, bg = FOOT_GRAY_BG }) {
  const y = lastBand ? BORDER_Y : BORDER_Y_SOFT;
  return (
    <>
      <td className={`${y} ${bg}`} />
      <td className={`w-7 px-0 ${y} ${bg}`} />
      <td
        className={`align-middle text-right whitespace-nowrap pr-1 ${y} ${BORDER_X} ${STICKY_PIN_FOOT} ${bg}`}
      >
        {children}
      </td>
    </>
  );
}

function DayPair({
  day,
  band,
  total,
  rowBg: stripe,
  canCreateDay,
  onOpen,
  showSalary,
  lastBand = false,
}) {
  const clickable =
    Boolean(onOpen) &&
    (Boolean(day.record) || Boolean(canCreateDay) || Boolean(day.hasSession));
  const title = clickable
    ? day.record
      ? undefined
      : "নতুন হাজিরা"
    : undefined;
  const open = clickable ? onOpen : undefined;
  const { paid, back } = settlementSides(day);
  const hasSession = !total && Boolean(day.hasSession || paid || back);
  const cellClass = [
    VALUE_CELL,
    stripe,
    clickable ? "cursor-pointer" : "",
    total && band === "top" ? "!align-baseline" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const leftClass = lastBand ? CELL_SUB_INNER : CELL_TOP_INNER;
  const rightClass = lastBand ? CELL_SUB : CELL_TOP;
  let left;
  let right;
  if (band === "top") {
    left = (
      <PresentLine
        present={day.present}
        salary={total ? null : day.salary}
        showSalary={!total && showSalary}
      />
    );
    right = <Amount value={day.extra} tone="text-success" />;
  } else if (band === "mid") {
    left = <Amount value={day.khoraki} tone="text-error" />;
    right = (
      <JoinedAmounts
        tone="text-error"
        parts={[{ value: day.advance }, { value: paid }]}
      />
    );
  } else {
    left = <Amount value={day.returned} tone={RETURN_TONE} />;
    right = <Amount value={back} tone={RETURN_TONE} />;
  }

  return (
    <>
      <td
        className={[
          cellClass,
          leftClass,
          sessionPairClass(hasSession, band, "left"),
        ].join(" ")}
        onClick={open}
        title={title}
      >
        {left}
      </td>
      <td
        className={[
          cellClass,
          rightClass,
          sessionPairClass(hasSession, band, "right"),
        ].join(" ")}
        onClick={open}
        title={title}
      >
        {right}
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