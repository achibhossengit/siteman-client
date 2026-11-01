import { Link } from 'react-router-dom'
import { paths } from '../router/paths.js'

export const BrandLogo = () => (
  <Link
    to={paths.home}
    className="flex items-center gap-1.5 min-w-0 shrink-0 text-base-content"
  >
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      className="h-9 w-9 shrink-0 object-contain"
    />
    <span className="text-lg font-semibold leading-normal overflow-visible">
      সাইটম্যান
    </span>
  </Link>
)
