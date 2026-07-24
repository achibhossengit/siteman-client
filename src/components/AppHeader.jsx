import { Link, NavLink } from "react-router-dom";
import { BrandLogo } from "./BrandLogo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { useAuth } from "../providers/AuthProvider.jsx";
import { paths } from "../router/paths.js";

/**
 * Shared top chrome: brand + theme + auth actions (login/register or profile).
 */
export const AppHeader = ({ className = "", sticky = false }) => {
  const { isAuthenticated, profile } = useAuth();

  return (
    <header
      className={`navbar bg-base-100 border-b border-base-300 px-3 sm:px-4 min-h-14 h-14 flex justify-between items-center ${sticky ? "sticky top-0 z-30" : ""}`}
    >
      <div>
        <BrandLogo />
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        {isAuthenticated ? (
          <>
            <ThemeToggle />
            <Link
              to={paths.profile}
              className="avatar placeholder"
              aria-label="প্রোফাইল"
              title={profile?.name || "প্রোফাইল"}
            >
              <div className="bg-neutral text-neutral-content w-8 rounded-full">
                <img src="/user.png" alt="" className="object-cover" />
              </div>
            </Link>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <NavLink to={paths.register} className="btn btn-outline btn-sm">
              রেজিস্টার
            </NavLink>
            <NavLink to={paths.login} className="btn btn-primary btn-sm">
              লগইন
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
};
