# SiteMan `src/` folder structure

Aligned with `docs/inital_plan.md`. Empty dirs use `.gitkeep` until modules are filled. UI theming comes next (DaisyUI).

```
src/
├── main.jsx                 # QueryClient + BrowserRouter bootstrap
├── App.jsx                  # Root shell (routes wired later)
├── index.css                # Tailwind + DaisyUI (+ theme tokens later)
├── assets/
├── app/
│   ├── providers/           # AuthProvider, QueryProvider helpers
│   ├── router/              # route table, path constants, guards
│   └── layouts/             # AuthLayout, AppLayout, SiteScopedLayout, LabourDetailLayout
├── api/
│   └── types/               # Live-contract shapes (JS modules / JSDoc)
│   # client.js, errors.js, endpoints.js — added when api-client-auth starts
├── features/
│   ├── auth/                # login, register, OTP, password reset
│   │   ├── components/      # OtpForm, …
│   │   └── pages/
│   ├── profile/             # GET/PATCH profile, change password
│   │   └── pages/
│   ├── users/               # users + groups + user↔site
│   │   ├── components/      # UserGroupPicker, SiteAssignPicker
│   │   └── pages/
│   ├── sites/               # sites, billing, report, ledger, cash, site users
│   │   ├── components/      # BulkDayGrid, LedgerTable/Form, UserAssignPicker
│   │   └── pages/
│   ├── labours/             # labours, attendances, payments, sessions
│   │   ├── components/      # SessionSummaryCard
│   │   └── pages/
│   └── home/
│       └── pages/
└── shared/
    ├── components/          # DateSelector, SiteSelector, DataTable, PermissionGate, …
    ├── hooks/               # usePermissions, useSiteScope
    ├── lib/                 # dates, money, permissions helpers
    └── constants/           # roles, errorCodes
```

## Route → feature map

| Routes | Folder |
| --- | --- |
| `/login`, `/register`, `/password/*` | `features/auth` |
| `/profile` | `features/profile` |
| `/users` | `features/users` |
| `/sites` | `features/sites` |
| `/labours` | `features/labours` |
| `/` | `features/home` |

Each feature will later get `api.js` + `hooks.js` at the feature root (vertical slice).
