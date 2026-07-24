import { Link } from 'react-router-dom'
import { paths } from '../router/paths.js'

export const BrandLogo = () => (
  <Link to={paths.home} className="flex items-end gap-2 text-base-content">
    <img src="/logo.svg" alt="সাইট ম্যান" className="h-10 w-10 object-contain" />
  </Link>
)
