export const PERMISSIONS = {
  BANK_DETAILS_READ: 'bank_details:read',
  BANK_DETAILS_WRITE: 'bank_details:write',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_POST: 'payments:post',
  QUEUES_READ: 'queues:read',
  CASHBOOK_POST: 'cashbook:post',
  AUDIT_READ: 'audit:read',
  USERS_MANAGE: 'users:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.OPERATOR]: [
    PERMISSIONS.BANK_DETAILS_READ,
    PERMISSIONS.BANK_DETAILS_WRITE,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.PAYMENTS_POST,
    PERMISSIONS.QUEUES_READ,
    PERMISSIONS.CASHBOOK_POST,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.BANK_DETAILS_READ,
    PERMISSIONS.PAYMENTS_READ,
    PERMISSIONS.QUEUES_READ,
  ],
};

export function normalizeRole(role: string | undefined | null): Role {
  const upper = String(role ?? '').toUpperCase();
  if (upper === ROLES.ADMIN) return ROLES.ADMIN;
  if (upper === ROLES.VIEWER) return ROLES.VIEWER;
  return ROLES.OPERATOR;
}

export function getPermissionsForRole(role: string | undefined | null): Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}

export function roleHasPermission(role: string | undefined | null, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.OPERATOR]: 'Operator',
  [ROLES.VIEWER]: 'Viewer',
};
