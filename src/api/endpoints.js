export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export const endpoints = {
  auth: {
    register: '/api/v1/auth/register',
    registerConfirm: '/api/v1/auth/register/confirm',
    registerResendOtp: '/api/v1/auth/register/resend-otp',
    passwordReset: '/api/v1/auth/password/reset',
    passwordResetConfirm: '/api/v1/auth/password/reset/confirm',
    passwordResetResendOtp: '/api/v1/auth/password/reset/resend-otp',
    passwordChange: '/api/v1/auth/password/change',
    tokenObtain: '/api/v1/auth/token/obtain',
    tokenRefresh: '/api/v1/auth/token/refresh',
    tokenBlacklist: '/api/v1/auth/token/blacklist',
  },
  profile: '/api/v1/profile',
  activities: {
    list: '/api/v1/activities',
    detail: (id) => `/api/v1/activities/${id}`,
    review: '/api/v1/activities/review',
  },
  sites: {
    list: '/api/v1/sites',
    detail: (id) => `/api/v1/sites/${id}`,
    activeLabour: (id) => `/api/v1/sites/${id}/active_labour`,
    dailyReports: (id) => `/api/v1/sites/${id}/daily-reports`,
    cash: (id) => `/api/v1/sites/${id}/cash`,
    cashByDate: (siteId, cashDate) =>
      `/api/v1/sites/${siteId}/cash/${cashDate}`,
    cashPendingLog: (siteId, cashDate) =>
      `/api/v1/sites/${siteId}/cash/${cashDate}/pending_log`,
    cashDetail: (siteId, cashId) => `/api/v1/sites/${siteId}/cash/${cashId}`,
    privateCash: (id) => `/api/v1/sites/${id}/private-cash`,
    privateCashDetail: (siteId, id) =>
      `/api/v1/sites/${siteId}/private-cash/${id}`,
    billingCategories: (id) => `/api/v1/sites/${id}/billing-categories`,
    billingCategoryDetail: (siteId, id) =>
      `/api/v1/sites/${siteId}/billing-categories/${id}`,
    activeBilling: (id) =>
      `/api/v1/sites/${id}/billing-categories/active-billing`,
    dailyRecords: (id) => `/api/v1/sites/${id}/daily-records`,
    dailyRecordsByDate: (siteId, recordDate) =>
      `/api/v1/sites/${siteId}/daily-records/${recordDate}`,
    dailyRecordsPendingLog: (siteId, recordDate) =>
      `/api/v1/sites/${siteId}/daily-records/${recordDate}/pending_log`,
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
