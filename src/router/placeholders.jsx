export const SitesPage = () => (
  <div className="card bg-base-100 border border-base-300">
    <div className="card-body gap-2">
      <h1 className="card-title text-xl">সাইটসমূহ</h1>
      <p className="text-sm text-base-content/70">সাইট তালিকা পরে।</p>
    </div>
  </div>
)

export const SiteLedgerPage = () => (
  <div className="card bg-base-100 border border-base-300">
    <div className="card-body gap-2">
      <h1 className="card-title text-xl">দৈনিক লেজার</h1>
      <p className="text-sm text-base-content/70">
        SiteScopedLayout — তারিখ ও সাইট সিলেক্টর উপরে।
      </p>
    </div>
  </div>
)

export const LaboursPage = () => (
  <div className="card bg-base-100 border border-base-300">
    <div className="card-body gap-2">
      <h1 className="card-title text-xl">শ্রমিক</h1>
      <p className="text-sm text-base-content/70">শ্রমিক তালিকা পরে।</p>
    </div>
  </div>
)

export const LabourOverviewPage = () => (
  <div className="card bg-base-100 border border-base-300">
    <div className="card-body gap-2">
      <h1 className="card-title text-xl">শ্রমিক ওভারভিউ</h1>
      <p className="text-sm text-base-content/70">LabourDetailTabs · DetailLayout।</p>
    </div>
  </div>
)

export const LabourSectionPage = ({ title }) => (
  <div className="card bg-base-100 border border-base-300">
    <div className="card-body gap-2">
      <h1 className="card-title text-xl">{title}</h1>
    </div>
  </div>
)

export const UsersPage = () => (
  <div className="card bg-base-100 border border-base-300">
    <div className="card-body gap-2">
      <h1 className="card-title text-xl">ইউজার</h1>
      <p className="text-sm text-base-content/70">ইউজার মডিউল পরে।</p>
    </div>
  </div>
)
