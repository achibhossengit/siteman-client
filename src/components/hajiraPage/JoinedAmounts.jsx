import { Fragment } from "react";
import { formatBnNumber } from "../../utils/format.js";

const num = (v) => Number(v) || 0;

/** Colour of a session settlement amount (distinct from extra/return/advance). */
export const SETTLEMENT_TONE = "text-secondary";
/** Colour of a return amount. */
export const RETURN_TONE = "text-info";

/**
 * A session settlement splits by sign: positive = site paid the labour
 * (counts with the right-hand payments), negative = labour paid back
 * (counts with the left-hand credits).
 */
export const splitSettlement = (settlement) => {
  const n = num(settlement);
  return { paid: n > 0 ? n : 0, back: n < 0 ? -n : 0 };
};

/**
 * Totals cell: "(present) earnings + extra". `earnings` is the earnings from
 * attendance only (null when unknown); `extra` is the extra earnings.
 */
export function PresentEarningsTotal({ present, earnings, extra, stacked }) {
  const p = num(present);
  const e = earnings == null ? 0 : num(earnings);
  const x = num(extra);
  if (!p && !e && !x) {
    return <span className="opacity-35">—</span>;
  }
  if (stacked) {
    // Total present on top, earnings (+ extra) underneath.
    return (
      <span className="inline-flex flex-col items-end tabular-nums">
        {p ? <span>{formatBnNumber(p)}</span> : null}
        {e || x ? (
          <span className="inline-flex items-baseline justify-end gap-0.5">
            {e ? <span>{formatBnNumber(e)}</span> : null}
            {x ? (
              <>
                {e ? <span className="opacity-60">+</span> : null}
                <span className="text-success">{formatBnNumber(x)}</span>
              </>
            ) : null}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline justify-end gap-0.5 tabular-nums">
      {p ? <span className="opacity-70">({formatBnNumber(p)})</span> : null}
      {e ? <span>{formatBnNumber(e)}</span> : null}
      {x ? (
        <>
          {p || e ? <span className="opacity-60">+</span> : null}
          <span className="text-success">{formatBnNumber(x)}</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * Non-zero amounts joined with "+", each in its own colour.
 * `parts`: [{ value, tone }]. Shows "—" when nothing is non-zero.
 */
export function JoinedAmounts({ parts }) {
  const shown = (parts ?? []).filter((part) => num(part.value) !== 0);
  if (!shown.length) {
    return <span className="opacity-35">—</span>;
  }
  return (
    <span className="inline-flex items-baseline justify-end gap-0.5">
      {shown.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="opacity-60">+</span> : null}
          <span className={part.tone || undefined}>
            {formatBnNumber(num(part.value))}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
