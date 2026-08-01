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
