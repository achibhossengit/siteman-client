import { formatBnNumber } from "../../utils/format.js";

const num = (v) => Number(v) || 0;

/** Colour of a session settlement amount (distinct from extra/return/advance). */
export const SETTLEMENT_TONE = "text-purple-500";
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

/** Prefer per-side totals so opposite sessions do not cancel. */
export const settlementSides = (d) => {
  if (d && (d.settlementPaid != null || d.settlementBack != null)) {
    return { paid: num(d.settlementPaid), back: num(d.settlementBack) };
  }
  return splitSettlement(d?.settlement);
};

/** Earnings minus given, plus returned (session settlement included). */
export const remainingOf = (d) => {
  const { paid, back } = settlementSides(d);
  return (
    num(d?.earnings) -
    num(d?.khoraki ?? d?.payment) -
    num(d?.advance) -
    paid +
    num(d?.returned ?? d?.return) +
    back
  );
};

export const remainTone = (value) =>
  num(value) > 0 ? "text-success" : num(value) < 0 ? "text-error" : "";

/**
 * Text size that steps down as a figure gets longer, so it still fits the
 * cell's max width. Short figures keep the cell's normal size.
 */
export const fitSizeClass = (text) => {
  const len = String(text ?? "").length;
  if (len <= 6) return "";
  if (len <= 8) return "text-[11px]";
  if (len <= 10) return "text-[10px]";
  return "text-[9px]";
};

/** A single amount; shows "—" when zero, shrinks when long. */
export function FitAmount({ value, tone }) {
  if (!num(value)) {
    return <span className="opacity-35">—</span>;
  }
  const text = formatBnNumber(num(value));
  return (
    <span className={[tone, fitSizeClass(text)].filter(Boolean).join(" ")}>
      {text}
    </span>
  );
}

/**
 * Present cell. Salary mode: `present × salary`. Earnings mode:
 * `(present) earnings`. Otherwise just the present. Salary is omitted when
 * unknown (e.g. footers); earnings are omitted when zero.
 */
export function PresentLine({ present, salary, showSalary }) {
  const p = num(present);
  if (!p) {
    return <span className="opacity-35">—</span>;
  }
  const pText = formatBnNumber(p);
  if (showSalary && salary != null && num(salary)) {
    const sText = formatBnNumber(num(salary));
    return (
      <span
        className={`inline-flex items-baseline justify-end gap-0.5 tabular-nums ${fitSizeClass(pText + sText + "×")}`}
      >
        <span>{pText}</span>
        <span className="opacity-50">×</span>
        <span>{sText}</span>
      </span>
    );
  }
  return <span className={fitSizeClass(pText) || undefined}>{pText}</span>;
}

/**
 * Sum of the amounts in one cell, shown as a single figure.
 * `parts`: [{ value, tone }]. `tone` colours the sum; when omitted, the tone
 * of the first non-zero part is used. Shows "—" when the sum is zero.
 */
export function JoinedAmounts({ parts, tone }) {
  const shown = (parts ?? []).filter((part) => num(part.value) !== 0);
  const total = shown.reduce((sum, part) => sum + num(part.value), 0);
  const sumTone = tone !== undefined ? tone : shown[0]?.tone;
  return <FitAmount value={total} tone={sumTone} />;
}
