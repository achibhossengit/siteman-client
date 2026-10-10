import { Fragment } from "react";
import { Link } from "react-router-dom";
import { PersonAvatar } from "../PersonAvatar.jsx";
import { paths } from "../../router/paths.js";
import { concatLabourName, formatBnNumber } from "../../utils/format.js";
import { formatDateColBn } from "../../utils/dateRange.js";
import { filterHeaderTitle } from "./helpers.js";
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
const STICKY_PIN_HEAD = "sticky left-0 z-20 !bg-base-100";
const ROW_EVEN = "!bg-base-100";
const ROW_ODD = "!bg-base-200";
const FOOT_BG = "!bg-base-300";
const VALUE_CELL =
  "text-right align-middle tabular-nums whitespace-nowrap leading-tight min-w-9 w-9 px-0.5 text-xs";

const rowBg = (index) => (index % 2 === 0 ? ROW_EVEN : ROW_ODD);

const Amount = ({ value, tone }) => {
  if (!value) {
    return <span className="text-base-content/35">—</span>;
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

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {!showDayColumns ? (
        <p className="text-xs text-base-content/60 px-3 py-1.5 shrink-0">
          এক মাসের বেশি সময়ে শুধু মোট দেখানো হচ্ছে।
        </p>
      ) : null}
      <div className="flex-1 min-h-0 overflow-auto pb-8">
        <table className="table table-xs w-max bg-transparent text-xs border-separate border-spacing-0 border-t border-l border-base-content/35 [&_th]:!px-1 [&_th]:!py-0.5 [&_td]:!px-0.5 [&_td]:!py-1 [&_tbody_tr]:bg-transparent [&_tbody_td]:bg-transparent [&_tbody_tr:hover]:bg-transparent [&_tfoot_tr]:bg-transparent [&_tfoot_td]:bg-transparent">
          <thead className="sticky top-0 z-10 bg-base-100">
            <tr>
              <th className={`w-7 align-middle ${CELL}`}>নং</th>
              <th className={`w-7 px-0 ${CELL_PIN}`} />
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
                      className={`text-center align-middle font-medium whitespace-nowrap px-0.5 ${CELL}`}
                    >
                      {formatDateColBn(iso)}
                    </th>
                  ))
                : null}
              <th
                colSpan={2}
                className={`text-center align-middle font-medium ${CELL}`}
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
                        <Amount value={row.totals.present} />
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
                      <td className={`${VALUE_CELL} ${CELL_SUB_INNER} ${stripe}`}>
                        <Amount value={row.totals.extra} tone="text-success" />
                      </td>
                      <td className={`${VALUE_CELL} ${CELL_SUB} ${stripe}`}>
                        <Amount value={row.totals.advance} tone="text-error" />
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
                <td rowSpan={2} className={`${CELL} ${FOOT_BG}`} />
                <td
                  rowSpan={2}
                  className={`w-7 px-0 ${CELL_PIN} ${FOOT_BG}`}
                />
                <td
                  rowSpan={2}
                  className={`align-middle whitespace-nowrap pl-1 ${CELL} ${STICKY_PIN} ${FOOT_BG}`}
                >
                  মোট
                </td>
                {showDayColumns
                  ? footer.byDate.map((day) => (
                      <DayPair
                        key={`foot-${day.date}`}
                        band="top"
                        day={day}
                        rowBg={FOOT_BG}
                      />
                    ))
                  : null}
                <td className={`${VALUE_CELL} ${CELL_TOP_INNER} ${FOOT_BG}`}>
                  <Amount value={footer.totals.present} />
                </td>
                <td className={`${VALUE_CELL} ${CELL_TOP} ${FOOT_BG}`}>
                  <Amount value={footer.totals.khoraki} tone="text-error" />
                </td>
              </tr>
              <tr className="font-medium bg-transparent">
                {showDayColumns
                  ? footer.byDate.map((day) => (
                      <DayPair
                        key={`foot-${day.date}-sub`}
                        band="sub"
                        day={day}
                        rowBg={FOOT_BG}
                      />
                    ))
                  : null}
                <td className={`${VALUE_CELL} ${CELL_SUB_INNER} ${FOOT_BG}`}>
                  <Amount value={footer.totals.extra} tone="text-success" />
                </td>
                <td className={`${VALUE_CELL} ${CELL_SUB} ${FOOT_BG}`}>
                  <Amount value={footer.totals.advance} tone="text-error" />
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function DayPair({ day, band, rowBg: stripe, canCreateDay, onOpen }) {
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
  const cellClass = [VALUE_CELL, stripe, clickable ? "cursor-pointer" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <td
        className={[cellClass, leftClass].join(" ")}
        onClick={open}
        title={title}
      >
        <Amount
          value={sub ? day.extra : day.present}
          tone={sub ? "text-success" : ""}
        />
      </td>
      <td
        className={[cellClass, rightClass].join(" ")}
        onClick={open}
        title={title}
      >
        <Amount value={sub ? day.advance : day.khoraki} tone="text-error" />
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