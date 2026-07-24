/** Stub — later wired to profile.sites (or GET /sites for company admin). */
export const SiteSelector = ({
  sites = [],
  value,
  onChange,
  className = '',
}) => {
  const options =
    sites.length > 0
      ? sites
      : [{ id: '', name: 'সাইট নির্বাচন (পরে)' }]

  return (
    <label className={`form-control w-full max-w-xs ${className}`}>
      <span className="label-text text-xs opacity-70 mb-1">সাইট</span>
      <select
        className="select select-bordered select-sm w-full"
        value={value ?? options[0]?.id ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {options.map((site) => (
          <option key={site.id || 'empty'} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  )
}
