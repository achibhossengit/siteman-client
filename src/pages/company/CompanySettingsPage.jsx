import { useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ExternalLink, MessageCircle, X } from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { formatDateBn } from '../../utils/dateRange.js'
import { formatBnNumber, STATUS_LABEL } from '../../utils/format.js'
import {
  companyFromProfile,
  getCompanyLimit,
} from '../../utils/subscription.js'

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/KwhvUROanr1GpdjL2ydBGS'

const dash = '—'

const formatLimit = (value) => {
  if (value == null) return dash
  return formatBnNumber(value)
}

const formatBool = (value) => {
  if (typeof value !== 'boolean') return dash
  return value ? STATUS_LABEL.active : STATUS_LABEL.inactive
}

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between gap-3 px-4 py-3 text-sm">
    <span className="text-base-content/70">{label}</span>
    <span className="font-medium text-right min-w-0 wrap-break-word">{value}</span>
  </div>
)

const InfoCard = ({ title, titleAction, children }) => (
  <section>
    {title ? (
      <div className="flex items-center justify-between gap-3 px-1 mb-1.5">
        <h2 className="text-sm font-medium text-base-content/55">{title}</h2>
        {titleAction}
      </div>
    ) : null}
    <div className="bg-base-100 rounded-2xl border border-base-300/80 overflow-hidden divide-y divide-base-300/70">
      {children}
    </div>
  </section>
)

export const CompanySettingsPage = () => {
  const { setTitle } = useOutletContext()
  const { profile } = useAuth()
  const infoModalRef = useRef(null)
  const company = companyFromProfile(profile)
  const companyName =
    company?.name ||
    (typeof profile?.company === 'string' ? profile.company : '') ||
    dash

  useEffect(() => {
    setTitle?.('কোম্পানি সেটিংস')
    return () => setTitle?.('')
  }, [setTitle])

  return (
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 px-3 py-3">
      <InfoCard>
        <InfoRow label="নাম" value={companyName} />
      </InfoCard>

      <InfoCard
        title="সাবস্ক্রিপশন"
        titleAction={
          <button
            type="button"
            className="text-sm font-medium text-primary shrink-0"
            onClick={() => infoModalRef.current?.showModal()}
          >
            আপডেট করুন
          </button>
        }
      >
        <InfoRow
          label="মেয়াদ"
          value={company?.paid_until ? formatDateBn(company.paid_until) : dash}
        />
        <InfoRow
          label="চালু ইউজার লিমিট"
          value={formatLimit(getCompanyLimit(profile, 'user'))}
        />
        <InfoRow
          label="চালু শ্রমিক লিমিট"
          value={formatLimit(getCompanyLimit(profile, 'labour'))}
        />
        <InfoRow
          label="সাইট লিমিট"
          value={formatLimit(getCompanyLimit(profile, 'site'))}
        />
      </InfoCard>

      <InfoCard title="সাইট কনফিগ">
        <InfoRow
          label="শ্রমিক সাইট পরিবর্তন"
          value={formatBool(company?.labour_transfer_allowed)}
        />
      </InfoCard>

      <dialog ref={infoModalRef} className="modal">
        <div className="modal-box max-w-sm">
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              aria-label="বন্ধ"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </form>
          <h3 className="font-semibold text-base mb-3 pr-8">সাবস্ক্রিপশন</h3>
          <p className="text-sm text-base-content/80">
            সাবস্ক্রিপশন প্ল্যান আপডেট করতে এই হোয়াটসঅ্যাপ গ্রুপে যোগ দিয়ে
            মেসেজ দিন।
          </p>
          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-success btn-outline w-full mt-4 gap-2"
          >
            <MessageCircle className="size-4" strokeWidth={1.75} />
            গ্রুপে যোগ দিন
            <ExternalLink className="size-3.5 opacity-60" strokeWidth={1.75} />
          </a>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">বন্ধ</button>
        </form>
      </dialog>
    </div>
  )
}
