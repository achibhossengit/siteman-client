import { useEffect, useMemo, useState } from "react";
import { Outlet, useParams, useSearchParams } from "react-router-dom";
import { DateSelector } from "../components/DateSelector.jsx";
import { SiteSelector } from "../components/SiteSelector.jsx";
import { useHideOnScroll } from "../hooks/useHideOnScroll.js";
import { useAuth } from "../providers/AuthProvider.jsx";
import {
  readSelectedDate,
  readSelectedSite,
  todayIso,
  writeSelectedDate,
  writeSelectedSite,
} from "../utils/sessionSelection.js";

/** Brand header height (h-14) — used to tuck it away on scroll-down. */
const BRAND_HEADER_H = "3.5rem";

const selectableSites = (profile) => {
  const list = Array.isArray(profile?.sites) ? profile.sites : [];
  return list.filter((s) => s && s.id != null && s.is_active !== false);
};

/**
 * Full app chrome + sticky site/date bar.
 * Scroll down: brand header hides; site bar + bottom nav stay.
 * Scroll up: brand header returns.
 * Site/date persist in sessionStorage as selectedSite / selectedDate.
 */
export const SiteScopedLayout = () => {
  const brandHidden = useHideOnScroll();
  const { profile } = useAuth();
  const { id: routeSiteId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sites = useMemo(() => selectableSites(profile), [profile]);

  const [siteId, setSiteId] = useState(
    () => routeSiteId || searchParams.get("site") || readSelectedSite() || "",
  );
  const [date, setDate] = useState(
    () => searchParams.get("date") || readSelectedDate() || todayIso(),
  );

  // Prefer first available site when nothing valid is selected.
  useEffect(() => {
    if (!sites.length) return;
    const valid = sites.some((s) => String(s.id) === String(siteId));
    if (!siteId || !valid) {
      const next = String(sites[0].id);
      setSiteId(next);
      writeSelectedSite(next);
    }
  }, [sites, siteId]);

  // Keep URL + session in sync with current selection.
  useEffect(() => {
    if (siteId) writeSelectedSite(siteId);
    if (date) writeSelectedDate(date);

    const params = new URLSearchParams(searchParams);
    let changed = false;
    if (siteId && params.get("site") !== String(siteId)) {
      params.set("site", String(siteId));
      changed = true;
    }
    if (date && params.get("date") !== date) {
      params.set("date", date);
      changed = true;
    }
    if (changed) setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when site/date change
  }, [siteId, date]);

  const onSiteChange = (next) => {
    setSiteId(next);
    writeSelectedSite(next);
  };

  const onDateChange = (next) => {
    setDate(next);
    writeSelectedDate(next);
  };

  return (
    <div>
      <header
        className={`bg-base-100 border-b border-base-300 w-full sticky top-0 z-30`}
      >
        <div className="max-w-5xl mx-auto w-full flex justify-between gap-2 items-stretch px-2 py-1.5">
          <DateSelector value={date} onChange={onDateChange} />
          <SiteSelector sites={sites} value={siteId} onChange={onSiteChange} />
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 py-2">
        <Outlet context={{ date, siteId, sites }} />
      </main>
    </div>
  );
};
