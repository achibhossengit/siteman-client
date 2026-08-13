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
