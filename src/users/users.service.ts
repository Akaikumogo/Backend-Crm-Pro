import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Branch } from '../entities/branch.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { BulkDeleteUsersDto } from './dto/bulk-delete-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ALL_PERMISSION_KEYS,
  isValidPermissionKey,
} from '../auth/permission-keys';
import { UpdateUserScopeDto } from './dto/update-user-scope.dto';

const userPublicSelect = {
  id: true,
  email: true,
  role: true,
  fullName: true,
  organizationId: true,
  branchId: true,
  permissions: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
  ) {}

  async create(dto: CreateUserDto, actor: JwtPayload) {
    if (dto.role === UserRole.SUPERADMIN) {
      throw new BadRequestException('Cannot create superadmin via API');
    }

    let organizationId = dto.organizationId ?? null;
    const branchId = dto.branchId ?? null;

    if (actor.role === UserRole.ORG_ADMIN) {
      organizationId = actor.organizationId ?? null;
      if (!organizationId) {
        throw new ForbiddenException();
      }
      if (dto.role === UserRole.STAFF) {
        if (!branchId) {
          throw new BadRequestException('branchId required for staff');
        }
        const b = await this.branches.findOne({ where: { id: branchId } });
        if (!b || b.organizationId !== organizationId) {
          throw new BadRequestException('Invalid branch');
        }
      }
    } else if (actor.role === UserRole.SUPERADMIN) {
      if (dto.role === UserRole.ORG_ADMIN || dto.role === UserRole.STAFF) {
        if (!organizationId) {
          throw new BadRequestException('organizationId required');
        }
      }
      if (dto.role === UserRole.STAFF && !branchId) {
        throw new BadRequestException('branchId required for staff');
      }
      if (dto.role === UserRole.STAFF && branchId) {
        const b = await this.branches.findOne({ where: { id: branchId } });
        if (!b || b.organizationId !== organizationId) {
          throw new BadRequestException('Invalid branch');
        }
      }
    } else {
      throw new ForbiddenException();
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let permissions: string[] | null = null;
    if (dto.role === UserRole.STAFF) {
      const list =
        dto.permissions !== undefined
          ? dto.permissions
          : [...ALL_PERMISSION_KEYS];
      for (const p of list) {
        if (!isValidPermissionKey(p)) {
          throw new BadRequestException(`Invalid permission key: ${p}`);
        }
      }
      permissions = list;
    }
    const row = this.users.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      role: dto.role,
      fullName: dto.fullName ?? null,
      organizationId,
      branchId: dto.role === UserRole.ORG_ADMIN ? null : branchId,
      permissions,
    });
    await this.users.save(row);
    return this.users.findOneOrFail({
      where: { id: row.id },
      select: userPublicSelect,
    });
  }

  async findAll(actor: JwtPayload) {
    if (actor.role === UserRole.SUPERADMIN) {
      return this.users.find({
        order: { createdAt: 'DESC' },
        select: userPublicSelect,
      });
    }
    if (actor.role === UserRole.ORG_ADMIN && actor.organizationId) {
      return this.users.find({
        where: { organizationId: actor.organizationId },
        order: { createdAt: 'DESC' },
        select: userPublicSelect,
      });
    }
    if (actor.role === UserRole.STAFF && actor.branchId) {
      return this.users.find({
        where: { branchId: actor.branchId },
        order: { createdAt: 'DESC' },
        select: userPublicSelect,
      });
    }
    return [];
  }

  async bulkRemove(dto: BulkDeleteUsersDto, actor: JwtPayload) {
    if (dto.deleteAllInScope) {
      const rows = await this.findAll(actor);
      const ids = rows
        .filter((u) => u.role !== UserRole.SUPERADMIN)
        .map((u) => u.id);
      return this.removeMany(ids, actor);
    }
    if (!dto.ids?.length) {
      throw new BadRequestException(
        'ids required when deleteAllInScope is false',
      );
    }
    return this.removeMany(dto.ids, actor);
  }

  async removeMany(ids: string[], actor: JwtPayload) {
    if (!ids.length) {
      return { deleted: 0 };
    }
    const targets = await this.users.find({
      where: { id: In(ids) },
    });
    for (const u of targets) {
      if (u.role === UserRole.SUPERADMIN) {
        throw new BadRequestException('Cannot delete superadmin');
      }
      if (actor.role === UserRole.ORG_ADMIN) {
        if (u.organizationId !== actor.organizationId) {
          throw new ForbiddenException();
        }
      } else if (actor.role !== UserRole.SUPERADMIN) {
        throw new ForbiddenException();
      }
    }
    const res = await this.users.delete(ids);
    return { deleted: res.affected ?? 0 };
  }

  async findOne(id: string, actor: JwtPayload) {
    const user = await this.users.findOne({
      where: { id },
      select: userPublicSelect,
    });
    if (!user) {
      throw new NotFoundException();
    }
    if (actor.role === UserRole.SUPERADMIN) {
      return user;
    }
    if (
      actor.role === UserRole.ORG_ADMIN &&
      user.organizationId === actor.organizationId
    ) {
      return user;
    }
    if (actor.role === UserRole.STAFF && user.branchId === actor.branchId) {
      return user;
    }
    throw new ForbiddenException();
  }

  async updatePermissions(
    id: string,
    permissions: string[],
    actor: JwtPayload,
  ) {
    for (const p of permissions) {
      if (!isValidPermissionKey(p)) {
        throw new BadRequestException(`Invalid permission key: ${p}`);
      }
    }
    const target = await this.users.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException();
    }
    if (target.role !== UserRole.STAFF) {
      throw new BadRequestException(
        'Only STAFF users can be assigned granular permissions',
      );
    }
    if (actor.role === UserRole.ORG_ADMIN) {
      if (target.organizationId !== actor.organizationId) {
        throw new ForbiddenException();
      }
    } else if (actor.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException();
    }
    target.permissions = permissions;
    await this.users.save(target);
    return this.users.findOneOrFail({
      where: { id },
      select: userPublicSelect,
    });
  }

  async updateScope(id: string, dto: UpdateUserScopeDto, actor: JwtPayload) {
    const target = await this.users.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException();
    }

    if (actor.role === UserRole.ORG_ADMIN) {
      if (!actor.organizationId || target.organizationId !== actor.organizationId) {
        throw new ForbiddenException();
      }
    } else if (actor.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException();
    }

    if (target.role !== UserRole.STAFF) {
      throw new BadRequestException('Only STAFF scope can be updated');
    }

    if (dto.branchId !== undefined) {
      const nextBranchId = dto.branchId ?? null;
      if (!nextBranchId) {
        throw new BadRequestException('branchId required for staff');
      }
      const b = await this.branches.findOne({ where: { id: nextBranchId } });
      if (!b || b.organizationId !== target.organizationId) {
        throw new BadRequestException('Invalid branch');
      }
      target.branchId = nextBranchId;
    }

    await this.users.save(target);
    return this.users.findOneOrFail({
      where: { id: target.id },
      select: userPublicSelect,
    });
  }
}
