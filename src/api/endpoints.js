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
  sites: {
    list: '/api/v1/sites',
    detail: (id) => `/api/v1/sites/${id}`,
    dailyReports: (id) => `/api/v1/sites/${id}/daily-reports`,
    cash: (id) => `/api/v1/sites/${id}/cash`,
    cashDetail: (siteId, cashId) => `/api/v1/sites/${siteId}/cash/${cashId}`,
    billingCategories: (id) => `/api/v1/sites/${id}/billing-categories`,
    billingCategoryDetail: (siteId, id) =>
      `/api/v1/sites/${siteId}/billing-categories/${id}`,
    labourAttendances: (id) => `/api/v1/sites/${id}/labour-attendances`,
    labourPayments: (id) => `/api/v1/sites/${id}/labour-payments`,
  },
  users: {
    list: '/api/v1/users',
    detail: (id) => `/api/v1/users/${id}`,
  },
  labours: {
    list: '/api/v1/labours',
    detail: (id) => `/api/v1/labours/${id}`,
    attendances: (labourId) => `/api/v1/labours/${labourId}/attendances`,
    attendanceDetail: (labourId, id) =>
      `/api/v1/labours/${labourId}/attendances/${id}`,
    payments: (labourId) => `/api/v1/labours/${labourId}/payments`,
    paymentDetail: (labourId, id) =>
      `/api/v1/labours/${labourId}/payments/${id}`,
    sessions: (labourId) => `/api/v1/labours/${labourId}/sessions`,
    session: (labourId, sessionId) =>
      `/api/v1/labours/${labourId}/sessions/${sessionId}`,
    runningSession: (labourId) =>
      `/api/v1/labours/${labourId}/sessions/running_session`,
    latestSession: (labourId) =>
      `/api/v1/labours/${labourId}/sessions/latest_session`,
  },
}
