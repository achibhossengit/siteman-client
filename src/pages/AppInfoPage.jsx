import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ExternalLink, Mail } from 'lucide-react'
import { version as appVersion } from '../../package.json'

const APP_NAME = 'সাইট ম্যান'
const APP_FULL_NAME = 'সাইট ম্যানেজার'
const APP_TAGLINE =
  'কনস্ট্রাকশন সাইটের হাজিরা, ক্যাশ ও ব্যালেন্স সহজে পরিচালনা করুন।'

const DEVELOPER = {
  name: 'আছিব হোসেন',
  nameEn: 'Achib Hossen',
  role: 'ডেভেলপার',
  email: 'mail.achibhossen@gmail.com',
  photo: '/developer.jpg',
}

export const AppInfoPage = () => {
  const { setTitle } = useOutletContext()

  useEffect(() => {
    setTitle?.('অ্যাপ তথ্য')
    return () => setTitle?.('')
  }, [setTitle])

  return (
    <div className="max-w-lg mx-auto w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
      <section className="card bg-base-100 border border-base-300">
        <div className="card-body items-center text-center gap-3 py-8">
          <img
            src="/logo.png"
            alt={APP_NAME}
            className="size-20 object-contain"
          />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{APP_NAME}</h2>
            <p className="text-sm text-base-content/70 mt-0.5">{APP_FULL_NAME}</p>
          </div>
          <p className="text-sm text-base-content/70 max-w-xs">{APP_TAGLINE}</p>
          <div className="badge badge-ghost badge-lg tabular-nums mt-1">
            ভার্সন {appVersion}
          </div>
        </div>
      </section>

      <section className="card bg-base-100 border border-base-300">
        <div className="card-body gap-4">
          <h3 className="font-semibold text-sm text-base-content/70">
            ডেভেলপার
          </h3>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="avatar shrink-0">
              <div className="w-28 rounded-box ring ring-base-300 ring-offset-base-100 ring-offset-2">
                <img
                  src={DEVELOPER.photo}
                  alt={DEVELOPER.nameEn}
                  className="object-cover"
                />
              </div>
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
              <div>
                <div className="text-lg font-semibold leading-tight">
                  {DEVELOPER.name}
                </div>
                <div className="text-sm text-base-content/60">
                  {DEVELOPER.nameEn} · {DEVELOPER.role}
                </div>
              </div>

              <a
                href={`mailto:${DEVELOPER.email}`}
                className="btn btn-ghost btn-sm gap-2 px-2 h-auto min-h-0 py-1.5 normal-case font-normal"
              >
                <Mail className="size-4 opacity-70" strokeWidth={1.75} />
                <span className="truncate">{DEVELOPER.email}</span>
                <ExternalLink className="size-3.5 opacity-50" strokeWidth={1.75} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-base-content/50 pb-2">
        © {new Date().getFullYear()} {APP_FULL_NAME}
      </p>
    </div>
  )
}
