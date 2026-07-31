/**
 * Live auth contracts (prefer over OpenAPI string placeholders).
 *
 * @typedef {{ access: string, refresh?: string }} TokenPair
 *
 * @typedef {{
 *   ticket: string,
 *   otp_expires_in?: number,
 *   resend_cooldown?: number,
 * }} OtpStartResponse
 *
 * @typedef {{
 *   id: number,
 *   name: string,
 *   phone_number: string,
 *   email: string | null,
 *   company?: { id: number, name: string } | null,
 *   is_active: boolean,
 *   is_staff?: boolean,
 *   is_companyadmin: boolean,
 *   groups: Array<{ id: number, name: string }>,
 *   permissions: string[],
 *   sites: Array<{ id: number, name: string, is_active?: boolean, is_closed?: boolean }>,
 * }} UserProfile
 */

export {}
