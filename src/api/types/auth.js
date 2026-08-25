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
 * GET /users/{id} — access snapshot only. No company site catalog.
 *
 * @typedef {{
 *   id: number,
 *   name: string,
 *   photo: string | null,
 *   phone_number: string,
 *   email: string | null,
 *   company?: { id: number, name: string } | null,
 *   is_active: boolean,
 *   is_staff?: boolean,
 *   is_companyadmin: boolean,
 *   allowed_groups: Array<{ id: number, name: string }>,
 *   allowed_permissions: string[],
 *   allowed_sites: number[],
 * }} UserDetail
 *
 * GET /profile — same snapshot plus company site catalog (`sites`) for name lookup.
 *
 * @typedef {UserDetail & {
 *   sites: Array<{ id: number, name: string, is_active?: boolean, is_closed?: boolean }>,
 * }} UserProfile
 */

export {}
