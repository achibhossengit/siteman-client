export const PERMS = {
  // accounts.User
  viewUser: 'accounts.view_user',
  addUser: 'accounts.add_user',
  changeUser: 'accounts.change_user',
  deleteUser: 'accounts.delete_user',

  // accounts.UserSite
  viewUserSite: 'accounts.view_usersite',
  addUserSite: 'accounts.add_usersite',
  changeUserSite: 'accounts.change_usersite',
  deleteUserSite: 'accounts.delete_usersite',

  // auth.Group (user role assign/remove)
  viewGroup: 'auth.view_group',
  addGroup: 'auth.add_group',
  changeGroup: 'auth.change_group',
  deleteGroup: 'auth.delete_group',

  // sites.Site
  viewSite: 'sites.view_site',
  addSite: 'sites.add_site',
  changeSite: 'sites.change_site',
  deleteSite: 'sites.delete_site',

  // sites.BillingCategory
  viewBillingCategory: 'sites.view_billingcategory',
  addBillingCategory: 'sites.add_billingcategory',
  changeBillingCategory: 'sites.change_billingcategory',
  deleteBillingCategory: 'sites.delete_billingcategory',

  // sites.SiteCash
  viewSiteCash: 'sites.view_sitecash',
  addSiteCash: 'sites.add_sitecash',
  changeSiteCash: 'sites.change_sitecash',
  deleteSiteCash: 'sites.delete_sitecash',

  // sites.PrivateSiteCash
  viewPrivateSiteCash: 'sites.view_privatesitecash',
  addPrivateSiteCash: 'sites.add_privatesitecash',
  changePrivateSiteCash: 'sites.change_privatesitecash',
  deletePrivateSiteCash: 'sites.delete_privatesitecash',

  // labours.Labour
  viewLabour: 'labours.view_labour',
  addLabour: 'labours.add_labour',
  changeLabour: 'labours.change_labour',
  deleteLabour: 'labours.delete_labour',

  // labours.LabourPayment
  viewLabourPayment: 'labours.view_labourpayment',
  addLabourPayment: 'labours.add_labourpayment',
  changeLabourPayment: 'labours.change_labourpayment',
  deleteLabourPayment: 'labours.delete_labourpayment',

  // labours.Attendance
  viewAttendance: 'labours.view_attendance',
  addAttendance: 'labours.add_attendance',
  changeAttendance: 'labours.change_attendance',
  deleteAttendance: 'labours.delete_attendance',

  // labours.LabourSession
  viewLabourSession: 'labours.view_laboursession',
  addLabourSession: 'labours.add_laboursession',
  changeLabourSession: 'labours.change_laboursession',
  deleteLabourSession: 'labours.delete_laboursession',
}

export const ROLE_NAMES = {
  companyAdmin: 'Company Admin',
  siteManager: 'Site Manager',
  siteAuditor: 'Site Auditor',
}

/** Display labels for ROLE_NAMES (API still uses English names). */
export const ROLE_LABELS_BN = {
  [ROLE_NAMES.companyAdmin]: 'অ্যাডমিন',
  [ROLE_NAMES.siteManager]: 'ম্যানেজার',
  [ROLE_NAMES.siteAuditor]: 'অডিটর',
}

export const groupLabelBn = (name) =>
  ROLE_LABELS_BN[name] ?? name ?? '—'

/** Never gate solely on group name strings — use permission codenames. */

export const hasPermission = (profile, codename) => {
  if (!profile || !codename) return false
  const list = profile.permissions
  return Array.isArray(list) && list.includes(codename)
}

export const hasAnyPermission = (profile, codenames = []) =>
  codenames.some((code) => hasPermission(profile, code))

export const hasAllPermissions = (profile, codenames = []) =>
  codenames.every((code) => hasPermission(profile, code))

/**
 * is_companyadmin bypasses site-assignment checks only — not model permissions.
 */
export const isCompanyAdmin = (profile) =>
  Boolean(profile?.is_companyadmin)
