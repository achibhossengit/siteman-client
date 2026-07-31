/**
 * Parse drf_standardized_errors shape:
 * `{ type, errors: [{ code, detail, attr }] }`
 *
 * Prefer `code` → Bangla copy; fall back to `detail` only if code unknown.
 */

/** @type {Record<string, string>} */
export const CODE_COPY = {
  // Auth / session (DRF + SimpleJWT)
  authentication_failed: 'ফোন নম্বর বা পাসওয়ার্ড মিলছে না। আবার চেষ্টা করুন।',
  not_authenticated: 'এই পেজ দেখতে আগে লগইন করতে হবে।',
  permission_denied: 'দুঃখিত, এই কাজটি করার অনুমতি আপনার নেই।',
  no_active_account: 'এই অ্যাকাউন্টটি পাওয়া যায়নি, অথবা এটি এখন সক্রিয় নয়।',
  token_not_valid: 'আপনার সেশনের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে আবার লগইন করুন।',
  already_registered: 'এই ফোন নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে।',

  // Rate limit / HTTP
  throttled: 'অল্প সময়ের মধ্যে অনেকবার চেষ্টা হয়েছে। একটু অপেক্ষা করে আবার চেষ্টা করুন।',
  not_found: 'আপনি যা খুঁজছেন, সেটি পাওয়া যায়নি।',
  method_not_allowed: 'এইভাবে অনুরোধটি গ্রহণ করা যাচ্ছে না।',
  not_acceptable: 'অনুরোধটি বর্তমানে গ্রহণ করা যাচ্ছে না।',
  unsupported_media_type: 'পাঠানো ডেটার ফরম্যাটটি সমর্থিত নয়।',
  parse_error: 'পাঠানো তথ্য ঠিকভাবে পড়া যায়নি। একটু পরখ করে আবার পাঠান।',

  // Validation (common DRF)
  required: 'এই ঘরটি পূরণ করা প্রয়োজন।',
  blank: 'এই ঘরটি খালি রাখা যাবে না।',
  null: 'এখানে একটি মান দিতে হবে।',
  invalid: 'দেওয়া তথ্যটি সঠিক মনে হচ্ছে না। একটু দেখে নিন।',
  invalid_choice: 'নির্বাচিত অপশনটি গ্রহণযোগ্য নয়।',
  unique: 'এই মানটি ইতিমধ্যে ব্যবহার করা হয়েছে। অন্যটি চেষ্টা করুন।',
  max_length: 'লেখাটি একটু বেশি লম্বা হয়ে গেছে।',
  min_length: 'লেখাটি আরও একটু বিস্তারিত হতে হবে।',
  max_value: 'মানটি অনুমোদিত সীমার চেয়ে বেশি।',
  min_value: 'মানটি অনুমোদিত সীমার চেয়ে কম।',
  max_digits: 'অঙ্কের সংখ্যা অনুমোদিত সীমা ছাড়িয়ে গেছে।',
  max_decimal_places: 'দশমিকের পর অনেক বেশি অঙ্ক দেওয়া হয়েছে।',
  max_whole_digits: 'পূর্ণ সংখ্যার অংশ একটু বড় হয়ে গেছে।',
  null_characters_not_allowed: 'এই লেখায় অনুমোদিত নয় এমন অক্ষর আছে।',
  surrogate_characters_not_allowed: 'এই লেখায় অনুমোদিত নয় এমন অক্ষর আছে।',

  // Password validators
  password_too_short: 'পাসওয়ার্ডটি আরও একটু লম্বা হলে ভালো হয়।',
  password_too_common: 'এই পাসওয়ার্ডটি খুব সাধারণ। একটু আলাদা কিছু বেছে নিন।',
  password_too_similar: 'পাসওয়ার্ডটি আপনার নাম বা অন্য তথ্যের সাথে খুব মিলে যাচ্ছে।',
  password_entirely_numeric: 'শুধু সংখ্যা দিয়ে পাসওয়ার্ড করা যাবে না। অক্ষরও যোগ করুন।',

  // OTP / verification
  required_email: 'ইমেইল ঠিকানা দিতে হবে।',
  expired: 'কোডটির মেয়াদ শেষ হয়ে গেছে। একটি নতুন কোড চান।',
  resend_cooldown: 'নতুন কোড পাঠানোর আগে একটু অপেক্ষা করুন।',
  max_resends: 'কোড অনুরোধের সীমা শেষ হয়ে গেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  max_attempts: 'ভুল কোড অনেকবার দেওয়া হয়েছে। অনুগ্রহ করে একটি নতুন কোড চান।',
  notification_delivery_failed: 'কোডটি পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন।',

  // Subscription
  subscription_expired: 'আপনার সাবস্ক্রিপশনের মেয়াদ শেষ। এখন শুধু তথ্য দেখা যাবে।',
  subscription_limit_exceeded: 'আপনার প্ল্যানের সীমা পূর্ণ হয়ে গেছে। নতুনটি তৈরি করা যাচ্ছে না।',

  // Sites / billing
  site_name_exists: 'এই নামে একটি সাইট ইতিমধ্যে আছে। অন্য নাম দিন।',
  site_closed: 'এই সাইটটি বন্ধ আছে, তাই এখন পরিবর্তন করা যাবে না।',
  site_has_records: 'এই সাইটে রেকর্ড থাকায় মুছে ফেলা যাচ্ছে না।',
  site_inactive: 'সাইটটি এখন নিষ্ক্রিয়। এই কাজটি পরে করা যেতে পারে।',
  site_wrong_company: 'এই সাইটটি আপনার কোম্পানির অধীনে নয়।',
  unauthorized_site: 'এই সাইটে প্রবেশের অনুমতি আপনার নেই।',
  billing_category_inactive: 'নির্বাচিত বিলিং ক্যাটাগরি এখন সক্রিয় নয়।',
  billing_category_name_exists: 'এই নামে একটি বিলিং ক্যাটাগরি ইতিমধ্যে আছে।',

  // Users
  user_name_exists: 'এই নামে একজন ইউজার ইতিমধ্যে আছেন। অন্য নাম দিন।',

  // Labours
  labour_inactive: 'এই শ্রমিক এখন নিষ্ক্রিয়। কাজ চালিয়ে যেতে আগে সক্রিয় করুন।',
  labour_name_exists: 'এই নামে একজন শ্রমিক ইতিমধ্যে আছেন। অন্য নাম দিন।',
  labour_unassigned: 'এই শ্রমিককে এখনও কোনো সাইটে যুক্ত করা হয়নি।',

  // Labour sessions
  session_no_records: 'সিল করার মতো কোনো রেকর্ড এখন নেই।',
  session_not_latest: 'শুধু সর্বশেষ সেশনটি মুছে ফেলা যায়।',
  session_snapshot_mismatch: 'সেশনের তথ্য বদলে গেছে। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।',

  // Records
  record_future_date: 'ভবিষ্যতের তারিখ দেওয়া যাবে না। আজ বা আগের তারিখ দিন।',
  record_date_not_after_last_session: 'শেষ সেশনের পরের তারিখ দিতে হবে।',
  record_sealed: 'এই রেকর্ডটি সিল করা আছে, তাই আর পরিবর্তন করা যাবে না।',
  record_unique_constraint_violation: 'এই তারিখের জন্য রেকর্ড ইতিমধ্যে আছে।',
  category_not_allowed: 'নির্বাচিত ক্যাটাগরিটি এখানে ব্যবহার করা যাবে না।',

  // Client fallbacks
  network_error: 'ইন্টারনেট সংযোগে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।',
  error: 'কিছু একটা ভুল হয়েছে। একটু পরে আবার চেষ্টা করুন।',
  server_error: 'সার্ভারে সমস্যা হয়েছে। আমরা বিষয়টি দেখছি—একটু পরে আবার চেষ্টা করুন।',
}

export const messageForCode = (code, fallbackDetail = null) => {
  if (code && CODE_COPY[code]) return CODE_COPY[code]
  if (fallbackDetail) return fallbackDetail
  return 'অনুরোধ ব্যর্থ হয়েছে।'
}

export const parseApiError = (error) => {
  const status = error?.response?.status ?? null
  const data = error?.response?.data

  if (!data || typeof data !== 'object') {
    const code = 'network_error'
    return {
      status,
      type: null,
      errors: [
        {
          code,
          detail: messageForCode(code),
          attr: null,
        },
      ],
      message: messageForCode(code),
      fieldErrors: {},
      isThrottled: status === 429,
      hasCode: (c) => c === code,
    }
  }

  const rawErrors = Array.isArray(data.errors)
    ? data.errors
    : [{ code: 'error', detail: null, attr: null }]

  const errors = rawErrors.map((item) => {
    const code = item?.code || 'error'
    return {
      code,
      detail: messageForCode(code, item?.detail),
      attr: item?.attr ?? null,
      rawDetail: item?.detail ?? null,
    }
  })

  const fieldErrors = {}
  for (const item of errors) {
    if (!item.attr || item.attr === 'non_field_errors') continue
    if (!fieldErrors[item.attr]) fieldErrors[item.attr] = []
    fieldErrors[item.attr].push(item.detail)
  }

  const nonField = errors.filter(
    (e) => !e.attr || e.attr === 'non_field_errors',
  )
  const message =
    (nonField.length
      ? nonField.map((e) => e.detail).join(' ')
      : errors.map((e) => e.detail).join(' ')) || messageForCode('error')

  return {
    status,
    type: data.type ?? null,
    errors,
    message,
    fieldErrors,
    isThrottled: status === 429 || errors.some((e) => e.code === 'throttled'),
    hasCode: (code) => errors.some((e) => e.code === code),
  }
}

export const humanizeApiError = (parsed) => {
  if (!parsed) return messageForCode('error')
  if (typeof parsed === 'string') return parsed
  if (parsed.isThrottled) return messageForCode('throttled')
  for (const err of parsed.errors || []) {
    if (err.code && CODE_COPY[err.code]) return CODE_COPY[err.code]
  }
  return parsed.message || messageForCode('error')
}

export const applyFieldErrors = (parsed, setError) => {
  if (!parsed?.fieldErrors || !setError) return
  for (const [attr, messages] of Object.entries(parsed.fieldErrors)) {
    setError(attr, { type: 'server', message: messages[0] })
  }
}
