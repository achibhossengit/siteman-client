/** Stub — full DateSelector (no future dates) comes with site modules. */
export const DateSelector = ({ value, onChange, className = '' }) => {
  const today = new Date().toISOString().slice(0, 10)
  const max = today

  return (
    <label className={`form-control w-full max-w-xs ${className}`}>
      <span className="label-text text-xs opacity-70 mb-1">তারিখ</span>
      <input
        type="date"
        className="input input-bordered input-sm w-full"
        value={value || today}
        max={max}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  )
}
