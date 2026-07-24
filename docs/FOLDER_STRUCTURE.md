# SiteMan `src/` folder structure

Flat / pages-first layout. Domain subfolders under `pages/` and `components/` only when files exist.

```
src/
├── main.jsx                 # QueryClient + providers + BrowserRouter bootstrap
├── App.jsx                  # Root shell → AppRouter
├── index.css                # Tailwind + DaisyUI
├── api/
│   ├── client.js            # axios instance, auth interceptors
│   ├── endpoints.js
│   ├── errors.js
│   ├── auth.js              # auth API calls
│   ├── profile.js           # profile API calls
│   └── types/               # live-contract shapes (JSDoc)
├── providers/               # AuthProvider, ThemeProvider
├── layouts/                 # AuthLayout, AppLayout, SiteScopedLayout, DetailLayout
├── router/                  # route table, path constants, guards, placeholders
├── pages/
│   ├── auth/                # login, register, OTP, password reset
│   ├── profile/             # profile, change password
│   ├── home/
│   ├── users/               # add when implementing
│   ├── sites/
│   └── labours/
├── components/
│   ├── auth/                # OtpForm, PendingOtpRedirect
│   ├── users/               # add when implementing
│   ├── sites/
│   ├── labours/
│   └── …                    # shared UI (BrandLogo, ThemeToggle, PermissionGate, …)
├── hooks/                   # usePermissions, …
└── utils/                   # theme, permissions (+ PERMS), otpSession, …
```
