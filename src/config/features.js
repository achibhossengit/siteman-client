/**
 * Feature flags from Vite env (build-time).
 * Truthy: True / true / 1 / yes (case-insensitive).
 */
const envFlag = (value) => {
  const v = String(value ?? '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

export const REGISTRATION_DISABLED = envFlag(
  import.meta.env.VITE_REGISTRATION_DISABLED,
)

export const REGISTRATION_DISABLED_MESSAGE =
  'এই সেবাটি সাময়িকভাবে বন্ধ আছে।  ঠিকাদার হিসেবে রেজিস্ট্রেশন করতে আপ টির কর্তৃপক্ষের সাথে যোগাযোগ করুন।  '

/**
 * Full-app maintenance mode (build-time).
 * When on, every route shows the maintenance page; auth/API bootstrap is skipped.
 */
export const MAINTENANCE = envFlag(import.meta.env.VITE_MAINTENANCE)

/** Optional until hint, e.g. "রাত ১২টা" or "২ ঘণ্টা পর" — shown under the main message. */
export const MAINTENANCE_UNTIL = String(
  import.meta.env.VITE_MAINTENANCE_UNTIL ?? '',
).trim()

export const MAINTENANCE_TITLE = 'রক্ষণাবেক্ষণ চলছে'

export const MAINTENANCE_MESSAGE =
  'সিস্টেম আপডেটের কারণে অ্যাপটি সাময়িকভাবে বন্ধ রাখা হয়েছে।'

export const MAINTENANCE_RETRY_MESSAGE = MAINTENANCE_UNTIL
  ? `অনুগ্রহ করে ${MAINTENANCE_UNTIL} আবার চেষ্টা করুন।`
  : 'অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'

/** Billing category UI (forms, filters, columns, history). Unset/false = hidden. */
export const SHOW_BILLING = envFlag(import.meta.env.VITE_SHOW_BILLING)

const BILLING_FIELD_KEYS = new Set(['billing', 'billing_id'])

export const isBillingFieldKey = (key) =>
  BILLING_FIELD_KEYS.has(String(key ?? ''))

export const visibleFieldKeys = (keys) =>
  SHOW_BILLING ? keys : keys.filter((key) => !isBillingFieldKey(key))

export const visibleFieldItems = (items, getKey = (item) => item?.key) =>
  SHOW_BILLING
    ? items
    : items.filter((item) => !isBillingFieldKey(getKey(item)))
