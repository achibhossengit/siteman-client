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
 * GET /company — tenant config, site catalog, assignable groups.
 *
 * @typedef {{
 *   id: number,
 *   name: string,
 *   site_limit?: number,
 *   active_user_limit?: number,
 *   active_labour_limit?: number,
 *   paid_until?: string | null,
 *   labour_transfer_allowed?: boolean,
 *   sites: Array<{ id: number, name: string, is_active?: boolean, is_closed?: boolean }>,
 *   groups: Array<{ id: number, name: string }>,
 * }} Company
 *
 * GET /users/{id} — identity plus assigned groups. No company payload.
 *
 * @typedef {{
 *   id: number,
 *   name: string,
 *   photo: string | null,
 *   phone_number: string,
 *   email: string | null,
 *   is_active: boolean,
 *   is_staff?: boolean,
 *   is_companyadmin: boolean,
 *   allowed_groups: number[],
 *   allowed_sites: number[],
 * }} UserDetail
 *
 * GET /profile — own user fields plus this user's access snapshot.
 * Company config and the site catalog are on GET /company.
 *
 * @typedef {{
 *   id: number,
 *   name: string,
 *   photo: string | null,
 *   phone_number: string,
 *   email: string | null,
 *   is_active: boolean,
 *   is_staff?: boolean,
 *   is_companyadmin: boolean,
 *   allowed_permissions: string[],
 *   allowed_sites: number[],
 * }} UserProfile
 */

export {}
