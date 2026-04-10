import { UserRole } from '../user-role.enum';

export type AuthMeResponse = {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  branchId: string | null;
  fullName: string | null;
  /** Raw DB value; null means legacy “all permissions” for STAFF. */
  permissions: string[] | null;
  /** What the UI and guards use for STAFF; all keys for org_admin / superadmin. */
  effectivePermissions: string[];
};
