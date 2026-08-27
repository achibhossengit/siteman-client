export const MODAL_VIEWS = {
  detail: "detail",
  history: "history",
};

export const RECORD_MODAL_ID = "hajira_record_modal";
export const LABOUR_FILTER_MODAL_ID = "hajira_labour_filter_modal";
export const EARNINGS_FILTER_MODAL_ID = "hajira_earnings_filter_modal";
export const PAYMENT_FILTER_MODAL_ID = "hajira_payment_filter_modal";
export const HAJIRA_FILTER_MODAL_ID = "hajira_hajira_filter_modal";
export const BILLING_FILTER_MODAL_ID = "hajira_billing_filter_modal";

export const HAJIRA_FILTER_OPTIONS = [
  { value: "present", label: "উপস্থিতি" },
  { value: "salary", label: "বেতন" },
  { value: "extra", label: "বাড়তি কাজ" },
];

export const HAJIRA_DEFAULT_FIELDS = ["present", "extra"];

export const LABOUR_FILTER_OPTIONS = [
  { value: "record", label: "হাজিরা" },
  { value: "labour", label: "শ্রমিক" },
];

export const LABOUR_DEFAULT_FIELDS = ["record", "labour"];

export const EARNINGS_FILTER_OPTIONS = [
  { value: "from_present", label: "বেতন থেকে আয়" },
  { value: "from_extra", label: "বাড়তি কাজ থেকে আয়" },
];

export const EARNINGS_DEFAULT_FIELDS = EARNINGS_FILTER_OPTIONS.map(
  (opt) => opt.value,
);

export const PAYMENT_FILTER_OPTIONS = [
  { value: "payment", label: "খোরাকি" },
  { value: "advance", label: "অ্যাডভান্স" },
  { value: "return", label: "রিটার্ন" },
];

export const PAYMENT_DEFAULT_FIELDS = PAYMENT_FILTER_OPTIONS.map(
  (opt) => opt.value,
);

export const PAYMENT_SPECS = [
  {
    key: "payment",
    noteKey: "paymentNote",
    idKey: "paymentId",
    sealedKey: "paymentSealed",
    type: "payment",
    label: "খোরাকি",
  },
  {
    key: "advance",
    noteKey: "advanceNote",
    idKey: "advanceId",
    sealedKey: "advanceSealed",
    type: "advance",
    label: "অ্যাডভান্স",
  },
  {
    key: "return",
    noteKey: "returnNote",
    idKey: "returnId",
    sealedKey: "returnSealed",
    type: "return",
    label: "রিটার্ন",
  },
];

export const MEANINGFUL_DAY_VALUE_MESSAGE =
  "হাজিরা, বাড়তি কাজ, খোরাকি, অ্যাডভান্স বা রিটার্নের অন্তত একটি মান ০-এর বেশি দিন।";

export const BULK_ROW_FIX_TOAST =
  "নিচের সমস্যাগুলো ঠিক করে আবার চেষ্টা করুন।";

export const BULK_CREATE_FIELD_LABELS = {
  date: "তারিখ",
  labour: "শ্রমিক",
  present: "হাজিরা",
  wage: "বেতন",
  extra_earn: "বাড়তি কাজ",
  fooding_pay: "খোরাকি",
  advance_pay: "অ্যাডভান্স",
  return_amount: "রিটার্ন",
  note: "নোট",
  billing: "বিলিং",
};
