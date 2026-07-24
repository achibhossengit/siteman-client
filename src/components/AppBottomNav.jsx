import { NavLink } from "react-router-dom";
import { paths } from "../router/paths.js";
import { Home, CalendarCheck, Wallet, Menu, Banknote } from "lucide-react";

const navItemClass = ({ isActive }) =>
  [
    "flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] sm:text-xs rounded-lg transition-colors",
    isActive
      ? "text-primary font-semibold"
      : "text-base-content/70 hover:text-base-content",
  ].join(" ");

export const AppBottomNav = () => {

  const items = [
    { to: paths.home, label: "ব্যলেন্স", icon: Banknote, end: true },
    { to: paths.profile, label: "হাজিরা", icon: CalendarCheck },
    { to: paths.profile, label: "ক্যাশ", icon: Wallet },
    { to: paths.profile, label: "আরও", icon: Menu },
  ];

  return (
    <nav className="bg-base-100 border-t border-base-300 fixed bottom-0 inset-x-0 z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-5xl mx-auto w-full flex justify-around items-stretch py-1.5 px-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navItemClass}>
            <Icon className="size-5" strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
