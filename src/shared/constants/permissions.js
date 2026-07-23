/** Common Django-style permission codenames used for soft UI gates. */
export const PERMS = {
  viewUser: 'users.view_user',
  addUser: 'users.add_user',
  changeUser: 'users.change_user',
  viewSite: 'sites.view_site',
  addSite: 'sites.add_site',
  changeSite: 'sites.change_site',
  viewLabour: 'labours.view_labour',
  addLabour: 'labours.add_labour',
  changeLabour: 'labours.change_labour',
}

export const ROLE_NAMES = {
  companyAdmin: 'Company Admin',
  siteManager: 'Site Manager',
  siteAuditor: 'Site Auditor',
}
