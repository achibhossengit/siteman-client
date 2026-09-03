import { Outlet } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.jsx";
import { AppBottomNav } from "../components/AppBottomNav.jsx";
import { SubscriptionExpiryBanner } from "../components/SubscriptionExpiryBanner.jsx";

export const AppLayout = () => (
  <div className="h-dvh bg-base-200 flex flex-col pb-14 overflow-hidden">
    <AppHeader />
    <SubscriptionExpiryBanner />
    <main className="flex-1 min-h-0 w-full max-w-5xl mx-auto flex flex-col overflow-y-auto">
      <Outlet />
    </main>
    <AppBottomNav />
  </div>
)