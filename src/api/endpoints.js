export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export const endpoints = {
  auth: {
    register: '/api/v1/auth/register',
    passwordReset: '/api/v1/auth/password/reset',
    passwordResetConfirm: '/api/v1/auth/password/reset/confirm',
    passwordResetResendOtp: '/api/v1/auth/password/reset/resend-otp',
    passwordChange: '/api/v1/auth/password/change',
    tokenObtain: '/api/v1/auth/token/obtain',
    tokenRefresh: '/api/v1/auth/token/refresh',
    tokenBlacklist: '/api/v1/auth/token/blacklist',
  },
  profile: '/api/v1/profile',
  company: '/api/v1/company',
  activities: {
    list: '/api/v1/activities',
    detail: (id) => `/api/v1/activities/${id}`,
    review: '/api/v1/activities/review',
  },
  sites: {
    list: '/api/v1/sites',
    detail: (id) => `/api/v1/sites/${id}`,
    dailyReports: (id) => `/api/v1/sites/${id}/daily-reports`,
    cash: (id) => `/api/v1/sites/${id}/cash`,
    cashDetail: (siteId, cashId) => `/api/v1/sites/${siteId}/cash/${cashId}`,
    privateCash: (id) => `/api/v1/sites/${id}/private-cash`,
    privateCashDetail: (siteId, id) =>
      `/api/v1/sites/${siteId}/private-cash/${id}`,
    billingCategories: (id) => `/api/v1/sites/${id}/billing-categories`,
    billingCategoryDetail: (siteId, id) =>
      `/api/v1/sites/${siteId}/billing-categories/${id}`,
    dailyRecords: (id) => `/api/v1/sites/${id}/daily-records`,
  },
  users: {
    list: '/api/v1/users',
    detail: (id) => `/api/v1/users/${id}`,
  },
  labours: {
    list: '/api/v1/labours',
    detail: (id) => `/api/v1/labours/${id}`,
    dailyRecords: (labourId) => `/api/v1/labours/${labourId}/daily-records`,
    dailyRecordDetail: (labourId, id) =>
      `/api/v1/labours/${labourId}/daily-records/${id}`,
    sessions: (labourId) => `/api/v1/labours/${labourId}/sessions`,
    session: (labourId, sessionId) =>
      `/api/v1/labours/${labourId}/sessions/${sessionId}`,
    runningSession: (labourId) =>
      `/api/v1/labours/${labourId}/sessions/running_session`,
    latestSession: (labourId) =>
      `/api/v1/labours/${labourId}/sessions/latest_session`,
  },
}
