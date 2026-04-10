import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { JwtPayload } from './jwt-payload.interface';
import { ALL_PERMISSION_KEYS } from './permission-keys';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  async validate(payload: {
    sub: string;
    role: UserRole;
    organizationId: string | null;
    branchId: string | null;
  }): Promise<JwtPayload> {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException();
    }
    const row = await this.users.findOne({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        permissions: true,
        organizationId: true,
        branchId: true,
      },
    });
    if (!row) {
      throw new UnauthorizedException();
    }
    let permissions: string[] | undefined;
    if (row.role === UserRole.STAFF) {
      permissions =
        row.permissions === null || row.permissions === undefined
          ? [...ALL_PERMISSION_KEYS]
          : [...row.permissions];
    }
    return {
      sub: row.id,
      role: row.role,
      organizationId: row.organizationId ?? null,
      branchId: row.branchId ?? null,
      permissions,
    };
  }
}
