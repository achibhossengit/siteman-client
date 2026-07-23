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
}
