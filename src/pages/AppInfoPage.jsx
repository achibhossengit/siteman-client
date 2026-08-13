import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { SHOW_BILLING } from '../config/features.js'
import {
  Activity,
  CalendarCheck,
  ExternalLink,
  MessageCircle,
  Scale,
  Users,
  Wallet,
  X,
} from 'lucide-react'

const APP_FULL_NAME = 'সাইট ম্যানেজার'

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'হাজিরা',
    description: 'শ্রমিকদের দৈনিক হাজিরা, বেতন, খোরাকি ও অগ্রিম হিসাব।',
  },
  {
    icon: Wallet,
    title: 'ক্যাশ',
    description: SHOW_BILLING
      ? 'সাইটের দৈনিক ক্যাশ এন্ট্রি, বিলিং ও খরচের হিসাব।'
      : 'সাইটের দৈনিক ক্যাশ এন্ট্রি ও খরচের হিসাব।',
  },
  {
    icon: Scale,
    title: 'ব্যালেন্স',
    description: 'সাইটভিত্তিক আয়-ব্যয়ের সারসংক্ষেপ এক নজরে।',
  },
  {
    icon: Users,
    title: 'ম্যানেজমেন্ট',
    description: 'সাইট, শ্রমিক ও ইউজার — সব এক জায়গা থেকে পরিচালনা।',
  },
  {
    icon: Activity,
    title: 'অ্যাক্টিভিটি লগ',
    description: 'কে কখন কী পরিবর্তন করেছে তার পূর্ণ হিস্ট্রি ও অডিট।',
  },
]

const LINKS = {
  whatsapp: 'https://chat.whatsapp.com/KwhvUROanr1GpdjL2ydBGS',
  portfolio: 'https://achibhossen.me',
}

const DEVELOPER_NAME = 'আছিব হোসেন'

export const AppInfoPage = () => {
  const { setTitle } = useOutletContext()
  const [showPortfolio, setShowPortfolio] = useState(false)

  useEffect(() => {
    setTitle?.(showPortfolio ? DEVELOPER_NAME : 'অ্যাপ তথ্য')
    return () => setTitle?.('')
  }, [setTitle, showPortfolio])

  if (showPortfolio) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-end gap-1 pb-2">
          <a
            href={LINKS.portfolio}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-square btn-sm"
            aria-label="নতুন ট্যাবে খুলুন"
          >
            <ExternalLink className="size-4" strokeWidth={1.75} />
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-square btn-sm"
            aria-label="বন্ধ"
            onClick={() => setShowPortfolio(false)}
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <iframe
          src={LINKS.portfolio}
          title={DEVELOPER_NAME}
          className="flex-1 min-h-0 w-full rounded-box border border-base-300 bg-base-100"
        />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
      <section className="card bg-transparent border border-base-300">
        <div className="card-body gap-3">
          <ul className="flex flex-col divide-y divide-base-300/70">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li
                key={title}
                className="flex items-start gap-3 py-3 first:pt-1 last:pb-1"
              >
                <span className="shrink-0 size-9 rounded-box bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="size-4.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{title}</div>
                  <p className="text-xs text-base-content/60 mt-0.5">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card bg-transparent border border-base-300">
        <div className="card-body gap-3">
          <h3 className="font-semibold text-sm text-base-content/70">
            সাপোর্ট ও কমিউনিটি
          </h3>
          <p className="text-sm text-base-content/70">
            কোনো সমস্যা, প্রশ্ন বা নতুন ফিচারের পরামর্শ থাকলে হোয়াটসঅ্যাপ
            গ্রুপে জানান।
          </p>
          <a
            href={LINKS.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="btn btn-success btn-outline w-full sm:w-auto sm:self-start gap-2"
          >
            <MessageCircle className="size-4" strokeWidth={1.75} />
            গ্রুপে যোগ দিন
            <ExternalLink className="size-3.5 opacity-60" strokeWidth={1.75} />
          </a>
        </div>
      </section>

      <p className="text-center text-xs text-base-content/50">
        © {new Date().getFullYear()} {APP_FULL_NAME} -{' '}
        <button
          type="button"
          className="link link-hover text-xs text-base-content/50"
          onClick={() => setShowPortfolio(true)}
        >
          {DEVELOPER_NAME}
        </button>
      </p>
    </div>
  )
}
