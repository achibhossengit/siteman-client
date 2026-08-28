import { Link } from "react-router-dom";
import { PersonAvatar } from "../PersonAvatar.jsx";
import { paths } from "../../router/paths.js";
import { concatLabourName, formatBnNumber } from "../../utils/format.js";
import { formatDateColBn } from "../../utils/dateRange.js";
import { filterHeaderTitle } from "./helpers.js";
import { LABOUR_DEFAULT_FIELDS } from "./constants.js";

const BORDER_Y = "border-b border-b-base-content/35";
const BORDER_X = "border-r border-r-base-content/35";
const BORDER_X_INNER = "border-r border-r-base-content/15";
const CELL = `${BORDER_Y} ${BORDER_X}`;
const CELL_INNER = `${BORDER_Y} ${BORDER_X_INNER}`;
const CELL_PIN = BORDER_Y;
const STICKY_PIN = "sticky left-0 z-[2] !bg-base-200";
const STICKY_PIN_HEAD = "sticky left-0 z-20 !bg-base-100";

const Stack = ({ present, extra, outflow, returned, side }) => {
  const left = side === "hajira";
  const primary = left ? present : outflow;
  const secondary = left ? extra : returned;
  const secondaryClass = left ? "text-success" : "text-success";
  const primaryClass = left ? "" : "text-error";
  if (!primary && !secondary) {
    return <span className="text-base-content/40">—</span>;
  }
  return (
    <span className="block w-full tabular-nums leading-tight space-y-0.5 text-right">
      {primary ? (
        <span className={`block ${primaryClass}`.trim()}>
          {formatBnNumber(primary)}
        </span>
      ) : null}
      {secondary ? (
        <span className={`block ${secondaryClass}`}>{formatBnNumber(secondary)}</span>
      ) : null}
    </span>
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
  showLabourDetailDenied,
  canCreateDay,
  onOpenDay,
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
      <table
        className="table table-sm w-full bg-transparent border-separate border-spacing-0 border-t border-l border-base-content/35 [&_tbody_tr]:bg-transparent [&_tbody_td]:bg-transparent [&_tbody_tr:hover]:bg-transparent [&_tfoot_tr]:bg-transparent [&_tfoot_td]:bg-transparent"
      >
        <thead className="sticky top-0 z-10 bg-base-100">
          <tr className="text-sm">
            <th className={`w-10 ${CELL}`}>নং</th>
            <th className={`w-11 pl-1 pr-0 ${CELL_PIN} ${STICKY_PIN_HEAD}`} />
            <th className={`min-w-28 pl-1 ${CELL}`}>
              <button type="button" onClick={openLabourFilterModal}>
                {filterHeaderTitle("নাম", labourFilter, LABOUR_DEFAULT_FIELDS)}
              </button>
            </th>
            {showDayColumns
              ? dates.map((iso) => (
                  <th
                    key={iso}
                    colSpan={2}
                    className={`text-center align-middle font-medium whitespace-nowrap px-1 ${CELL}`}
                  >
                    {formatDateColBn(iso)}
                  </th>
                ))
              : null}
            <th
              colSpan={2}
              className={`text-center align-middle font-medium ${CELL}`}
            >
              <div className="grid grid-cols-2 text-xs font-normal mt-0.5">
                <span className="text-center">হাজিরা</span>
                <span className="text-center">লেনদেন</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                className={`text-center text-sm text-base-content/60 py-10 ${CELL}`}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const offSite = isLabourOffSite(row);
              return (
                <tr key={row.labourId} className="bg-transparent">
                  <td className={`tabular-nums text-base-content/60 ${CELL}`}>
                    {formatBnNumber(index + 1)}
                  </td>
                  <td className={`w-11 pl-1 pr-0 ${CELL_PIN} ${STICKY_PIN}`}>
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
                      />
                    </LabourIdentity>
                  </td>
                  <td className={`font-medium pl-1 ${CELL}`}>
                    <LabourIdentity
                      row={row}
                      offSite={offSite}
                      canOpen={canOpenLabourDetail(row)}
                      onDenied={showLabourDetailDenied}
                    >
                      <span className="link link-hover">
                        {concatLabourName(row.labourName)}
                      </span>
                    </LabourIdentity>
                  </td>
                  {showDayColumns
                    ? row.days.map((day) => {
                        const clickable =
                          Boolean(day.record) || Boolean(canCreateDay);
                        const cellClass = [
                          "text-right align-top min-w-16 px-1 bg-transparent",
                          clickable ? "cursor-pointer" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");
                        const open = () => {
                          if (clickable) onOpenDay(row, day);
                        };
                        return (
                          <FragmentPair
                            key={day.date}
                            onClick={open}
                            className={cellClass}
                            title={
                              day.record
                                ? undefined
                                : canCreateDay
                                  ? "নতুন হাজিরা"
                                  : undefined
                            }
                            left={
                              <Stack
                                side="hajira"
                                present={day.present}
                                extra={day.extra}
                              />
                            }
                            right={
                              <Stack
                                side="lenden"
                                outflow={day.outflow}
                                returned={day.returned}
                              />
                            }
                          />
                        );
                      })
                    : null}
                  <td className={`text-right align-top min-w-16 ${CELL_INNER}`}>
                    <Stack
                      side="hajira"
                      present={row.totals.present}
                      extra={row.totals.extra}
                    />
                  </td>
                  <td className={`text-right align-top min-w-16 ${CELL}`}>
                    <Stack
                      side="lenden"
                      outflow={row.totals.outflow}
                      returned={row.totals.returned}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {rows.length > 0 ? (
          <tfoot>
            <tr className="font-medium bg-transparent">
              <td className={CELL} />
              <td className={`w-11 pl-1 pr-0 ${CELL_PIN} ${STICKY_PIN}`} />
              <td className={`whitespace-nowrap pl-1 ${CELL}`}>মোট</td>
              {showDayColumns
                ? footer.byDate.map((day) => (
                    <FragmentPair
                      key={`foot-${day.date}`}
                      className="text-right align-top min-w-16 px-1 bg-transparent"
                      left={
                        <Stack
                          side="hajira"
                          present={day.present}
                          extra={day.extra}
                        />
                      }
                      right={
                        <Stack
                          side="lenden"
                          outflow={day.outflow}
                          returned={day.returned}
                        />
                      }
                    />
                  ))
                : null}
              <td className={`text-right align-top ${CELL_INNER}`}>
                <Stack
                  side="hajira"
                  present={footer.totals.present}
                  extra={footer.totals.extra}
                />
              </td>
              <td className={`text-right align-top ${CELL}`}>
                <Stack
                  side="lenden"
                  outflow={footer.totals.outflow}
                  returned={footer.totals.returned}
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

function LabourIdentity({ row, offSite, canOpen, onDenied, children }) {
  const muted = offSite ? "text-base-content/45" : "";
  if (row.labourId != null && canOpen) {
    return (
      <Link
        to={paths.labourDetail(row.labourId)}
        className={["flex items-center min-w-0", muted]
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
          "flex items-center min-w-0 text-left cursor-pointer",
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
    <span className={["flex items-center min-w-0", muted].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}

function FragmentPair({ left, right, className, onClick, title }) {
  return (
    <>
      <td
        className={[className, CELL_INNER].filter(Boolean).join(" ")}
        onClick={onClick}
        title={title}
      >
        {left}
      </td>
      <td
        className={[className, CELL].filter(Boolean).join(" ")}
        onClick={onClick}
        title={title}
      >
        {right}
      </td>
    </>
  );
}
