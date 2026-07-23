import { api } from '../../api/client.js'
import { endpoints } from '../../api/endpoints.js'

export const obtainToken = ({ phone_number, password }) =>
  api.post(endpoints.auth.tokenObtain, { phone_number, password })

export const refreshToken = () => api.post(endpoints.auth.tokenRefresh, {})

export const blacklistToken = () => api.post(endpoints.auth.tokenBlacklist, {})

export const register = (payload) =>
  api.post(endpoints.auth.register, payload)

export const registerConfirm = ({ ticket, otp }) =>
  api.post(endpoints.auth.registerConfirm, { ticket, otp })

export const registerResendOtp = ({ ticket }) =>
  api.post(endpoints.auth.registerResendOtp, { ticket })

export const passwordReset = ({ phone_number, name }) =>
  api.post(endpoints.auth.passwordReset, { phone_number, name })

export const passwordResetConfirm = ({ ticket, otp, new_password }) =>
  api.post(endpoints.auth.passwordResetConfirm, {
    ticket,
    otp,
    new_password,
  })

export const passwordResetResendOtp = ({ ticket }) =>
  api.post(endpoints.auth.passwordResetResendOtp, { ticket })

export const passwordChange = ({ current_password, new_password }) =>
  api.post(endpoints.auth.passwordChange, {
    current_password,
    new_password,
  })
