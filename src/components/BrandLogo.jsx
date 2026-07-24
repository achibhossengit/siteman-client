import { Link } from 'react-router-dom'

export const BrandLogo = ({ to = '/', compact = false, className = '' }) => (
  <Link to={to} className={`flex items-center gap-2 no-underline text-base-content ${className}`}>
    <img
      src="/logo.svg"
      alt=""
      className={compact ? 'h-8 w-8 object-contain' : 'h-10 w-10 object-contain'}
    />
    <span className={compact ? 'font-semibold text-sm' : 'font-bold text-lg leading-tight'}>
      সাইট ম্যান
    </span>
  </Link>
)
