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
import { Branch } from '../entities/branch.entity';
import { UserRole } from '../user-role.enum';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { JwtPayload } from './jwt-payload.interface';

/** Faqat filial xodimi (STAFF): bloklangan filial uchun API yopiladi. Org admin barcha filiallarni boshqaradi. */
@Injectable()
export class BranchBlockedGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly config: ConfigService,
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
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
    if (!user || user.role !== UserRole.STAFF || !user.branchId) {
      return true;
    }
    const branch = await this.branches.findOne({
      where: { id: user.branchId },
      select: { id: true, isBlocked: true },
    });
    if (branch?.isBlocked) {
      const supportPhone = this.config.get<string>('SUPPORT_PHONE', '').trim();
      throw new HttpException(
        {
          code: 'BRANCH_BLOCKED',
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
