<p align="center">
  <img src="docs/banner.png" alt="SiteMan">
</p>

<h3 align="center">
  A SaaS application that helps construction companies to manage expenses with accountability.
</h3>

<p align="center">
  <a href="https://siteman.achibhossen.me">Live app</a>
  ·
  <a href="https://github.com/achibhossengit/siteman-api">Backend Repo</a>
  ·
  <a href="https://siteman-api.achibhossen.me/api/docs">API docs</a>
  ·
  <a href="https://youtube.com/playlist?list=PLB6H2J30mWdg">Tutorials</a>
</p>

## Overview

Siteman is a SaaS-based construction management platform designed to help construction companies manage their day-to-day operations from a centralized system.

This repository is the React frontend that powers the live app. It talks to the [SiteMan REST API](https://github.com/achibhossengit/siteman-api) for authentication, company data, and operational records.


## Features

- Shared layouts, header, and bottom navigation for a consistent UI across pages
- Company registration, login, and password-reset screens
- Session handling in the browser, including silent token refresh and protected routes
- Permission-aware screens and actions (admin, site manager, site auditor)
- Site, staff, and labour management interfaces
- Daily attendance, wage, and work-period screens with site and date filters
- Cash, expense, and private-bill forms with image and file uploads
- Site- and date-based balance summaries
- Activity log UI for inspecting and reviewing changes
- Subscription expiry and usage-limit notices
- Bengali-language interface with light, dark, and system themes
- Build-time flags for billing UI and a full-app maintenance page


## Workflow

Signed-in pages share a header (user menu) and, on daily work screens, a bottom nav: **Balance**, **Attendance**, **Cash**, **Audit**. Those four pages keep a site and date (or date range) selector at the top.

### Typical path

- Register a company on **Register**, or sign in on **Login** (phone number and password). The registrant is company admin.
- Open the user menu → **Sites** and create sites.
- User menu → **Labours**: add labour to a site.
- On **Attendance**, pick a site and date, then record presence, wages, and cash paid that day.
- On **Cash**, log deposit, cost, or withdrawal. Private bills are on the **site detail** page.
- Open **Balance** for the same site and date range.
- On a **labour detail** page, close the work session when the period is finished.
- Open **Audit** and review unreviewed changes.

### Company

Company admin only: user menu → **Company settings**.

- View subscription dates and site / user / labour limits (not self-serve). An expired company stays read-only in the UI.
- Edit the company name and whether labour can be transferred between sites.
- Delete the company (password confirm). That removes the workspace and signs you out.

### Sites

User menu → **Sites**. Company admin sees every site; other users only see sites they are assigned to. The site/date selector on daily pages uses the same assignment.

- Create a site from the list, then open **site detail** to edit or delete (password confirm). Delete is blocked while unsealed attendance rows exist.
- If billing UI is on, manage billing categories on site detail (used as tags on Attendance and Cash).
- Private cash (admin ledger) is also on site detail, not on the Cash tab.

### Staff accounts

A company admin can run the company alone, or share work. User menu → **Users**.

| Role | Typical use in this app |
|------|-------------------------|
| Site Manager | Attendance, Cash, labour, work sessions for assigned sites |
| Site Auditor | Read those pages and **review** entries on Audit |

- Create staff with name, phone, initial password, role, and allowed sites.
- Staff sign in on **Login**, then change their own password on **Profile**. They only see assigned sites in selectors and lists.
- Open **user detail** to disable, reassign sites/roles, or delete (password confirm). After create, the admin cannot change a staff password.

### Daily work (a site’s books)

Pick site and date in the header of the bottom-nav pages.

1. **Attendance** — presence, wage, extra earn, fooding, advance, returns (one row per labour per date).
2. **Cash** — deposit, cost, withdrawal, with optional receipt files.
3. **Site detail → private cash** — bill or cost for company admin, not the site manager’s public ledger.
4. **Balance** — cash in vs cash out for that site and range.

### Labour

User menu → **Labours**, then **labour detail**. A labour belongs to one site at a time.

- Create labour and assign a current site. Daily rows are entered on **Attendance**.
- Deactivate on labour detail so they drop off the live Attendance roster; past rows still show in history and session records.
- Delete only when they have no attendance rows. Closing a session does not unlock delete — sealed rows still exist.
- Open a session on labour detail to see its summary, or open the session records page for the sealed daily rows.

### Transfer between sites

Site managers can only record against labour currently on a site they can access. Transfer is **labour detail** → edit → change current site (company setting must allow transfers).

- After transfer, the previous site’s managers no longer see that labour on **Labours** or the Attendance roster, and cannot add new rows.
- Historical attendance stays on the previous site (history, sessions, Audit).
- Only company admin can leave labour unassigned (no site).

### Work sessions

Labour often take fooding or advance during a period; the rest stays payable. On **labour detail**, close the running session when the period is finished.

- The page shows a session summary: present days, earnings, fooding, advance, returns, payable. Credit or debt carries into the next session.
- Related Attendance rows become sealed (locked on Attendance and on the session records page).
- Only the latest session can be deleted from labour detail, and only if its sealed row count still matches; delete unseals those rows.

### Site balance

**Balance** answers: for this site and date range, what is the cash balance and what is still owed.

- The same site and date selectors as Attendance and Cash.
- Wage is payable until fooding or advance is recorded on Attendance.
- Users who can view private cash also see private totals here.

### Audit

**Audit** lists creates, updates, and deletes on attendance, site cash, and work sessions (who, what, when). Unreviewed changes show a badge on the record (Attendance, Cash, sessions).

- Site managers’ work is logged; they can open Audit for their sites.
- Review (clear the badge, optional note) is on Audit. Site Auditor and company admin can review; review is site-scoped for non-admins.
- After review, permitted users can still open an entry and see who changed it and who reviewed it.




## Tech stack

| Area              | Choice                                                  |
| ----------------- | ------------------------------------------------------- |
| App               | React 19, Vite 8                                        |
| Routing           | React Router 7                                          |
| Data fetching     | TanStack Query, Axios                                   |
| Forms             | React Hook Form, Zod                                    |
| UI                | Tailwind CSS 4, DaisyUI 5, Lucide                       |
| Feedback          | react-hot-toast, SweetAlert2                            |
| Hosting           | Netlify                                                 |


## Getting started

Requires Node.js 20+ and a running [SiteMan API](https://github.com/achibhossengit/siteman-api) (default `http://127.0.0.1:8000`).

```bash
git clone https://github.com/achibhossengit/siteman-client.git
cd siteman-client
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev
```

- App: `http://127.0.0.1:5173/`
- Dev proxy: `/api` and `/media` → `VITE_API_PROXY_TARGET` (default `http://127.0.0.1:8000`)


## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Dev server with API proxy            |
| `npm run build`   | Production build                     |
| `npm run preview` | Preview the production build locally |
| `npm run lint`    | Oxlint                               |


## Environment

Copy `.env.example` to `.env`. Common variables:

| Variable                   | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `VITE_API_BASE_URL`        | Browser-facing API base. Leave empty in local dev (same origin + proxy). In production, set to `https://siteman-api.achibhossen.me`. |
| `VITE_API_PROXY_TARGET`    | Local Vite proxy target for `/api` and `/media`.                        |
| `VITE_SHOW_BILLING`        | Show billing-category UI. Unset or `false` hides it.                    |
| `VITE_MAINTENANCE`         | Full-app maintenance page. Requires a rebuild.                          |
| `VITE_MAINTENANCE_UNTIL`   | Optional “until” phrase on the maintenance page.                        |


## Author

Developed by [Achib Hossen](https://achibhossen.me) — frontend (this repo) and the [Django backend](https://github.com/achibhossengit/siteman-api) that powers the live app.
