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
  onOpenDay,
}) {
  const dayCount = showDayColumns ? dates.length : 0;
  const colCount = 2 + dayCount * 2 + 2;

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
            <th className={`min-w-28 ${CELL}`}>
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
              const nameMutedClass = offSite ? "text-base-content/45" : "";
              return (
                <tr key={row.labourId} className="bg-transparent">
                  <td className={`tabular-nums text-base-content/60 ${CELL}`}>
                    {formatBnNumber(index + 1)}
                  </td>
                  <td className={`font-medium ${CELL}`}>
                    <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
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
                          onClick={() => void showLabourDetailDenied(row)}
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
                        <span
                          className={[
                            "flex items-center gap-2 min-w-0",
                            nameMutedClass,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
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
                  </td>
                  {showDayColumns
                    ? row.days.map((day) => {
                        const clickable = Boolean(day.record);
                        const cellClass = [
                          "text-right align-top min-w-16 px-1 bg-transparent",
                          clickable ? "cursor-pointer" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");
                        const open = () => {
                          if (clickable) onOpenDay(row, day.record);
                        };
                        return (
                          <FragmentPair
                            key={day.date}
                            onClick={open}
                            className={cellClass}
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
              <td className={`whitespace-nowrap ${CELL}`}>
                মোট
              </td>
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

function FragmentPair({ left, right, className, onClick }) {
  return (
    <>
      <td
        className={[className, CELL_INNER].filter(Boolean).join(" ")}
        onClick={onClick}
      >
        {left}
      </td>
      <td
        className={[className, CELL].filter(Boolean).join(" ")}
        onClick={onClick}
      >
        {right}
      </td>
    </>
  );
}
