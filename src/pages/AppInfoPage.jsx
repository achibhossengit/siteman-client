import { useEffect } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  BookOpen,
  ExternalLink,
  MessageCircle,
  PlayCircle,
} from 'lucide-react'
import { SHOW_BILLING } from '../config/features.js'
import { useAuth } from '../providers/AuthProvider.jsx'
import { paths } from '../router/paths.js'

const LINKS = {
  youtube: 'https://youtube.com/playlist?list=PLB6H2J30mWdg',
  whatsapp: 'https://chat.whatsapp.com/KwhvUROanr1GpdjL2ydBGS',
}

const MANUAL_STEPS = [
  'ঠিকাদার হলে আগে রেজিস্ট্রেশন করুন, তারপর ফোন নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন।',
  'উপরের তারিখ ও সাইট সিলেক্টর থেকে কাজের দিন ও সাইট বেছে নিন।',
  'হাজিরা পেজে শ্রমিকদের উপস্থিতি, বেতন, খোরাকি, অ্যাডভান্স ও রিটার্ন সেট করুন।',
  SHOW_BILLING
    ? 'ক্যাশ পেজে জমা, উত্তোলন ও সাইট খরচ এন্ট্রি করুন; প্রয়োজনে বিলিং যোগ করুন।'
    : 'ক্যাশ পেজে জমা, উত্তোলন ও সাইট খরচ এন্ট্রি করুন।',
  'ব্যালেন্স পেজে সাইটের আয়-ব্যয় ও বর্তমান ব্যালেন্স এক নজরে দেখুন।',
  'প্রয়োজনে সাইট, শ্রমিক ও ইউজার ম্যানেজমেন্ট থেকে তথ্য আপডেট করুন।',
  'অডিট পেজে কে কখন কী পরিবর্তন করেছে তা যাচাই করুন।',
]

const SupportContent = ({ showLoginLink = false }) => (
  <>
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-sm flex items-center gap-2">
        <BookOpen className="size-4 text-primary" strokeWidth={1.75} />
        উদ্দেশ্য
      </h2>
      <p className="text-sm text-base-content/75 leading-relaxed">
        সাইট ম্যানেজার নির্মাণ সাইটের দৈনিক হাজিরা, ক্যাশ ও ব্যালেন্স হিসাব এক
        জায়গায় পরিচালনা করতে সাহায্য করে। ঠিকাদার ও সাইট দল সহজে শ্রমিকের
        উপস্থিতি, খরচ ও আয়-ব্যয় ট্র্যাক করে স্বচ্ছ হিসাব রাখতে পারেন।
      </p>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-sm">ব্যবহারবিধি</h2>
      <ol className="list-decimal list-outside pl-5 flex flex-col gap-2 text-sm text-base-content/75 leading-relaxed">
        {MANUAL_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>

    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-sm">ভিডিও ও সাপোর্ট</h2>
      <p className="text-sm text-base-content/70">
        বিস্তারিত দেখতে ইউটিউব প্লেলিস্ট দেখুন, অথবা প্রশ্ন ও সমস্যার জন্য
        হোয়াটসঅ্যাপ গ্রুপে যোগ দিন।
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={LINKS.youtube}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-primary w-full gap-2"
        >
          <PlayCircle className="size-4" strokeWidth={1.75} />
          ইউটিউব প্লেলিস্ট
          <ExternalLink className="size-3.5 opacity-60" strokeWidth={1.75} />
        </a>
        <a
          href={LINKS.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-success w-full gap-2"
        >
          <MessageCircle className="size-4" strokeWidth={1.75} />
          হোয়াটসঅ্যাপ গ্রুপ
          <ExternalLink className="size-3.5 opacity-60" strokeWidth={1.75} />
        </a>
      </div>
    </section>

    {showLoginLink ? (
      <Link to={paths.login} className="btn btn-ghost btn-sm self-center">
        লগইনে ফিরে যান
      </Link>
    ) : null}
  </>
)

export const AppInfoPage = () => {
  const { isAuthenticated } = useAuth()
  const { setTitle } = useOutletContext() ?? {}

  useEffect(() => {
    if (!setTitle) return
    setTitle('সাহায্য')
    return () => setTitle('')
  }, [setTitle])

  if (isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 px-3 py-3">
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body gap-4">
            <SupportContent />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body gap-4">
        <div className="text-center">
          <h1 className="card-title justify-center text-2xl">সাহায্য</h1>
          <p className="text-sm text-base-content/70 mt-1">
            সাইট ম্যানেজার কীভাবে ব্যবহার করবেন
          </p>
        </div>
        <SupportContent showLoginLink />
      </div>
    </div>
  )
}
