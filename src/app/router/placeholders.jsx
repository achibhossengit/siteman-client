const Placeholder = ({ title, hint }) => (
  <div className="card bg-base-100 border border-base-300">
    <div className="card-body gap-2">
      <h1 className="card-title text-xl">{title}</h1>
      {hint ? <p className="text-sm text-base-content/70">{hint}</p> : null}
    </div>
  </div>
)

export const HomePage = () => (
  <Placeholder
    title="হোম"
    hint="লেআউট প্রিভিউ — মডিউল পরে যোগ হবে।"
  />
)

export const LoginPage = () => (
  <div className="card bg-base-100 shadow-sm border border-base-300">
    <div className="card-body gap-3">
      <h1 className="card-title justify-center text-2xl">লগইন</h1>
      <p className="text-center text-sm text-base-content/70">
        AuthLayout প্রিভিউ — ফর্ম পরে।
      </p>
      <button type="button" className="btn btn-primary" disabled>
        লগইন
      </button>
    </div>
  </div>
)

export const SitesPage = () => (
  <Placeholder title="সাইটসমূহ" hint="সাইট তালিকা পরে।" />
)

export const SiteLedgerPage = () => (
  <Placeholder
    title="দৈনিক লেজার"
    hint="SiteScopedLayout — তারিখ ও সাইট সিলেক্টর উপরে।"
  />
)

export const LaboursPage = () => (
  <Placeholder title="শ্রমিক" hint="শ্রমিক তালিকা পরে।" />
)

export const LabourOverviewPage = () => (
  <Placeholder title="শ্রমিক ওভারভিউ" hint="LabourDetailLayout ট্যাব।" />
)

export const LabourSectionPage = ({ title }) => <Placeholder title={title} />

export const UsersPage = () => (
  <Placeholder title="ইউজার" hint="PermissionGate পরে।" />
)

export const ProfilePage = () => <Placeholder title="প্রোফাইল" />
