/** Site picker — options from profile.sites (or parent-provided list). */
export const SiteSelector = ({
  sites = [],
  value,
  onChange,
  className = '',
}) => {
  const options =
    sites.length > 0
      ? sites
      : [{ id: '', name: 'সাইট নির্বাচন করুন' }]

  return (
    <label className={`form-control w-full max-w-xs ${className}`}>
      <span className="label-text text-xs opacity-70 mb-1">সাইট নির্বাচন করুন</span>
      <select
        className="select select-bordered select-sm w-full"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={!sites.length}
      >
        {!sites.length ? (
          <option value="">সাইট নেই</option>
        ) : null}
        {options.map((site) => (
          <option key={site.id || 'empty'} value={site.id}>
            {site.name}
            {site.is_closed ? ' (বন্ধ)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
