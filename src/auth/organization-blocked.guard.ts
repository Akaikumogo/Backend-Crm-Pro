import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { UserRole } from '../user-role.enum';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class OrganizationBlockedGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly config: ConfigService,
    @InjectRepository(Organization)
    private readonly orgs: Repository<Organization>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      return true;
    }
    if (user.role === UserRole.SUPERADMIN) {
      return true;
    }
    if (!user.organizationId) {
      return true;
    }
    const org = await this.orgs.findOne({
      where: { id: user.organizationId },
      select: { id: true, isBlocked: true },
    });
    if (org?.isBlocked) {
      const supportPhone = this.config.get<string>('SUPPORT_PHONE', '').trim();
      throw new HttpException(
        {
          code: 'ORG_BLOCKED',
          message:
            'Saytdan foydalanish huquqingiz tugatilgan. Qo‘llab-quvvatlash bilan bog‘laning.',
          supportPhone: supportPhone || undefined,
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
