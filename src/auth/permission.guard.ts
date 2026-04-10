import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../user-role.enum';
import { JwtPayload } from './jwt-payload.interface';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ANY_PERMISSIONS_KEY } from './decorators/require-any-permissions.decorator';
import { PERMISSIONS_KEY } from './decorators/require-permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException();
    }
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.ORG_ADMIN) {
      return true;
    }

    const anyRequired = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (anyRequired?.length) {
      if (user.role !== UserRole.STAFF) {
        throw new ForbiddenException();
      }
      const granted = user.permissions ?? [];
      if (!anyRequired.some((p) => granted.includes(p))) {
        throw new ForbiddenException();
      }
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }
    if (user.role !== UserRole.STAFF) {
      throw new ForbiddenException();
    }
    const granted = user.permissions ?? [];
    for (const p of required) {
      if (!granted.includes(p)) {
        throw new ForbiddenException();
      }
    }
    return true;
  }
}
