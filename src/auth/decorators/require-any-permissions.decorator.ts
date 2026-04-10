import { SetMetadata } from '@nestjs/common';

export const ANY_PERMISSIONS_KEY = 'anyPermissions';

/** STAFF must have at least one of the listed permissions. org_admin / superadmin always pass. */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
