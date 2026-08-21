import { Construction } from "lucide-react";
import {
  MAINTENANCE_MESSAGE,
  MAINTENANCE_RETRY_MESSAGE,
  MAINTENANCE_TITLE,
} from "../config/features.js";

export const MaintenancePage = () => (
  <div className="card bg-base-100 shadow-sm border border-base-300">
    <div className="card-body gap-4 items-center text-center">
      <div className="rounded-full bg-warning/15 text-warning p-3">
        <Construction className="size-8" aria-hidden />
      </div>
      <h1 className="text-center text-2xl">{MAINTENANCE_TITLE}</h1>
      <p className="text-base-content/70">{MAINTENANCE_MESSAGE}</p>
      <p className="text-sm text-base-content/70">
        {MAINTENANCE_RETRY_MESSAGE}
      </p>

      <p className="text-xs text-base-content/50">
        সাময়িক অসুবিধার জন্য দুঃখিত।
      </p>
    </div>
  </div>
);
