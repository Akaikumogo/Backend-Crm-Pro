import { UserRole } from '../user-role.enum';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  organizationId: string | null;
  branchId: string | null;
  /** Effective permissions for STAFF (from DB + legacy default). Omitted for other roles. */
  permissions?: string[];
}
