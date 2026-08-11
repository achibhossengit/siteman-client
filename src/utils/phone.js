import { z } from 'zod'

/** Local BD mobile: 01[3-9]XXXXXXXX (11 digits). */
export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/

export const BD_PHONE_MESSAGE =
  'সঠিক বাংলাদেশি ফোন নম্বর দিন (০১XXXXXXXXX)'

export const bdPhoneNumberSchema = z
  .string()
  .trim()
  .regex(BD_PHONE_REGEX, BD_PHONE_MESSAGE)

export const isBdPhoneNumber = (value) =>
  BD_PHONE_REGEX.test(String(value ?? '').trim())
