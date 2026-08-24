import { PersonAvatar } from './PersonAvatar.jsx'

const LabeledList = ({ label, items, emptyLabel }) => (
  <div>
    <div className="text-base-content/70 mb-1">{label}</div>
    {items.length ? (
      <ol className="list-decimal space-y-0.5 pl-6 text-sm text-base-content/80">
        {items.map((item) => (
          <li key={item.key}>{item.label}</li>
        ))}
      </ol>
    ) : (
      <p className="text-sm text-base-content/55">{emptyLabel}</p>
    )}
  </div>
)

export const UserProfileCard = ({
  photo,
  name,
  phone,
  email,
  company,
  groups = [],
  sites = [],
  status,
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-4">
      <PersonAvatar
        photo={photo}
        name={name}
        size="lg"
        shape="square"
        alt={name || 'প্রোফাইল ছবি'}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-semibold text-base leading-snug truncate">
          {name || '—'}
        </div>
        <div className="tabular-nums text-sm text-base-content/80 truncate">
          ফোন নম্বরঃ {phone || '—'}
        </div>
        <div className="text-sm text-base-content/70 break-all">
          ইমেইলঃ {email || '—'}
        </div>
        <div className="text-sm text-base-content/70 break-all">
          কোম্পানিঃ {company || '—'}
        </div>
      </div>
    </div>

    <div className="border-t border-base-300" />

    <div className="space-y-3 text-sm">
      {status ? (
        <div>
          <span className="text-base-content/70">স্ট্যাটাস : </span>
          <span className="font-medium">{status}</span>
        </div>
      ) : null}
      <LabeledList
        label="গ্রুপ :"
        items={groups}
        emptyLabel="কোনো গ্রুপ নির্ধারণ করা হয়নি।"
      />
      <LabeledList
        label="দায়িত্বপ্রাপ্ত সাইট :"
        items={sites}
        emptyLabel="কোনো সাইট নির্ধারণ করা হয়নি।"
      />
    </div>
  </div>
)
