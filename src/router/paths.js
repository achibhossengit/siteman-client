export const paths = {
  home: '/',
  balance: '/balance',
  hajira: '/hajira',
  cash: '/cash',

  sites: '/sites',
  siteDetail: (id) => `/sites/${id}`,
  users: '/users',
  userDetail: (id) => `/users/${id}`,
  labours: '/labours',
  labourDetail: (id) => `/labours/${id}`,
  labourSessionRecords: (labourId, sessionId) =>
    `/labours/${labourId}/sessions/${sessionId}/records`,
  appInfo: '/app-info',
  companySettings: '/company-settings',
  activities: '/activities',
  login: '/login',
  register: '/register',
  passwordReset: '/password/reset',
  passwordResetConfirm: '/password/reset/confirm',
  profile: '/profile',
  maintenance: '/maintenance',
}
