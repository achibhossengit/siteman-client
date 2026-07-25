export const SiteSelector = ({
  sites = [],
  value,
  onChange,
  className = "",
}) => (
  <label className={`form-control w-full max-w-xs ${className}`}>
    <select
      className="select select-bordered select-sm w-full"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {sites.length > 0 ? (
        <>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </>
      ) : (
        <option value="">সাইট নির্বাচন করুন</option>
      )}
    </select>
  </label>
);
