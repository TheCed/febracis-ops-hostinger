export const ALL_PERMISSIONS = [
  'dashboard.view',
  'clients.view',
  'clients.edit',
  'clients.print',
  'print.mass',
  'consultants.view',
  'consultants.edit',
  'courses.view',
  'courses.edit',
  'users.view',
  'users.edit',
  'settings.view',
  'settings.edit',
  'sheets.sync',
  'ficha.edit',
  'reports.view',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  comercial: [
    'dashboard.view',
    'clients.view',
    'clients.edit',
    'clients.print',
    'print.mass',
    'consultants.view',
    'courses.view',
    'reports.view',
  ],
  layout: [
    'dashboard.view',
    'clients.view',
    'clients.print',
    'print.mass',
    'courses.view',
    'ficha.edit',
  ],
  viewer: ['dashboard.view', 'clients.view', 'consultants.view', 'courses.view', 'reports.view'],
}
