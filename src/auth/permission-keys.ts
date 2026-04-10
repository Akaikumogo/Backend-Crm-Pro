/** Module/action strings for STAFF; org_admin and superadmin bypass checks. */
export const ALL_PERMISSION_KEYS = [
  'dashboard.home',
  'sales.indicators',
  'workers.read',
  'workers.write',
  'branches.read',
  'branches.write',
  'blocks.read',
  'blocks.write',
  'blocks.delete',
  'floors.read',
  'floors.write',
  'floors.delete',
  'apartments.read',
  'apartments.write',
  'apartments.delete',
  'apartments.presence',
  'clients.read',
  'clients.write',
  'clients.delete',
  'contracts.read',
  'contracts.write',
  'contracts.delete',
  'integrations.mqtt',
  'showroom',
  'legal',
] as const;

export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

export function isValidPermissionKey(k: string): k is PermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(k);
}
