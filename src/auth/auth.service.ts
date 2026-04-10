import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { AuthMeResponse } from './auth-me.response';
import { JwtPayload } from './jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
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
