/** Stub — full DateSelector (no future dates) comes with site modules. */
export const DateSelector = ({ value, onChange, className = "" }) => {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <label className={`form-control w-full max-w-xs ${className}`}>
      <input
        type="date"
        className="input input-bordered input-sm w-full"
        value={value}
        max={today}
        onChange={(e) => {
          const next = e.target.value || today;
          onChange?.(next);
        }}
      />
    </label>
  );
};
