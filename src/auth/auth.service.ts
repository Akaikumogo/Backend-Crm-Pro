import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { Organization } from '../entities/organization.entity';
import {
  SuperadminNotification,
  SuperadminNotificationType,
} from '../entities/superadmin-notification.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { AuthMeResponse } from './auth-me.response';
import { ApprovePasswordResetDto } from './dto/approve-password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload.interface';
import { ALL_PERMISSION_KEYS } from './permission-keys';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgs: Repository<Organization>,
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    @InjectRepository(SuperadminNotification)
    private readonly notifications: Repository<SuperadminNotification>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.findOne({
      where: { email: dto.email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        organizationId: true,
        branchId: true,
        fullName: true,
        permissions: true,
      },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
      branchId: user.branchId,
    };

    let organizationBlocked = false;
    if (user.organizationId) {
      const org = await this.orgs.findOne({
        where: { id: user.organizationId },
        select: { isBlocked: true },
      });
      organizationBlocked = org?.isBlocked ?? false;
    }

    let branchBlocked = false;
    if (user.branchId) {
      const br = await this.branches.findOne({
        where: { id: user.branchId },
        select: { isBlocked: true },
      });
      branchBlocked = br?.isBlocked ?? false;
    }

    const supportPhone = this.config.get<string>('SUPPORT_PHONE', '').trim();

    const effectivePermissions = this.effectivePermissions(user);

    return {
      access_token: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        branchId: user.branchId,
        fullName: user.fullName,
        permissions: user.permissions,
        effectivePermissions,
      },
      organizationBlocked,
      branchBlocked,
      supportPhone: supportPhone || undefined,
    };
  }

  private effectivePermissions(user: {
    role: UserRole;
    permissions: string[] | null;
  }): string[] {
    if (user.role === UserRole.STAFF) {
      return user.permissions === null || user.permissions === undefined
        ? [...ALL_PERMISSION_KEYS]
        : [...user.permissions];
    }
    return [...ALL_PERMISSION_KEYS];
  }

  /** Foydalanuvchi o'z parolini eski parol orqali o'zgartiradi */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException();
    }
    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Joriy parol notogri');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.save(user);
    return { success: true };
  }

  /** Foydalanuvchi parolini tiklash so'rovini yuboradi (superadmin tasdiq kutadi) */
  async requestPasswordReset(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException();
    }
    if (user.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException('Superadmin o\'z parolini bu yo\'l bilan tiklay olmaydi');
    }

    const pending = await this.notifications.findOne({
      where: {
        requestedUserId: userId,
        type: SuperadminNotificationType.PASSWORD_RESET_REQUEST,
        isApproved: false,
        readAt: null as unknown as Date,
      },
    });
    if (pending) {
      return { success: true, message: 'So\'rov allaqachon yuborilgan, superadmin tasdiqini kuting' };
    }

    const notification = this.notifications.create({
      type: SuperadminNotificationType.PASSWORD_RESET_REQUEST,
      organizationId: user.organizationId ?? null,
      requestedUserId: userId,
      message: `Parolni tiklash so'rovi: ${user.fullName ?? user.email} (${user.email})`,
      isApproved: false,
    });
    await this.notifications.save(notification);
    return { success: true, message: 'So\'rov yuborildi. Superadmin tasdiqlagach yangi parol o\'rnatiladi.' };
  }

  /** Superadmin parol tiklash so'rovini tasdiqlaydi va yangi parol o'rnatadi */
  async approvePasswordReset(
    notificationId: string,
    dto: ApprovePasswordResetDto,
    actor: JwtPayload,
  ) {
    if (actor.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException();
    }
    const notification = await this.notifications.findOne({
      where: {
        id: notificationId,
        type: SuperadminNotificationType.PASSWORD_RESET_REQUEST,
      },
    });
    if (!notification) {
      throw new NotFoundException('Bildirishnoma topilmadi');
    }
    if (notification.isApproved) {
      throw new BadRequestException('Bu so\'rov allaqachon tasdiqlangan');
    }
    if (!notification.requestedUserId) {
      throw new BadRequestException('Foydalanuvchi ID topilmadi');
    }

    const user = await this.users.findOne({
      where: { id: notification.requestedUserId },
    });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.save(user);

    notification.isApproved = true;
    notification.readAt = new Date();
    await this.notifications.save(notification);

    return { success: true, message: `${user.email} foydalanuvchisining paroli yangilandi` };
  }

  async me(userId: string): Promise<AuthMeResponse> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        branchId: true,
        fullName: true,
        permissions: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      branchId: user.branchId,
      fullName: user.fullName,
      permissions: user.permissions,
      effectivePermissions: this.effectivePermissions(user),
    };
  }
}
