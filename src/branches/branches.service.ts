import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { EncryptionService } from '../common/encryption.service';
import { Apartment } from '../entities/apartment.entity';
import { Branch } from '../entities/branch.entity';
import { Contract } from '../entities/contract.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    @InjectRepository(Organization)
    private readonly orgs: Repository<Organization>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly encryption: EncryptionService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private assertOrgAccess(user: JwtPayload, organizationId: string) {
    if (user.role === UserRole.SUPERADMIN) {
      return;
    }
    if (
      user.role === UserRole.ORG_ADMIN &&
      user.organizationId === organizationId
    ) {
      return;
    }
    throw new ForbiddenException();
  }

  async create(organizationId: string, dto: CreateBranchDto, user: JwtPayload) {
    this.assertOrgAccess(user, organizationId);
    const org = await this.orgs.findOne({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const branch = this.branches.create({
      organizationId,
      name: dto.name,
      code: dto.code ?? null,
      isBlocked: false,
      blockedAt: null,
      blockedReason: null,
      isVip: false,
      mqttUrl: dto.mqttUrl ?? null,
      mqttUsername: dto.mqttUsername ?? null,
      mqttPasswordEncrypted:
        dto.mqttPassword != null && dto.mqttPassword !== ''
          ? this.encryption.encrypt(dto.mqttPassword)
          : null,
      mqttTopic: dto.mqttTopic ?? null,
    });
    const saved = await this.branches.save(branch);

    if (dto.staffEmail && dto.staffPassword) {
      const email = dto.staffEmail.toLowerCase().trim();
      const exists = await this.users.exist({ where: { email } });
      if (exists) {
        throw new BadRequestException('Filial xodimi emaili allaqachon band');
      }
      const passwordHash = await bcrypt.hash(dto.staffPassword, 10);
      await this.users.save(
        this.users.create({
          email,
          passwordHash,
          role: UserRole.STAFF,
          fullName: dto.staffFullName ?? null,
          organizationId,
          branchId: saved.id,
        }),
      );
    }

    return this.sanitize(saved);
  }

  async findByOrganization(organizationId: string, user: JwtPayload) {
    this.assertOrgAccess(user, organizationId);
    const rows = await this.branches.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
    return rows.map((b) => this.sanitize(b));
  }

  async findOne(id: string, user: JwtPayload) {
    const branch = await this.branches.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (user.role === UserRole.STAFF) {
      if (user.branchId !== id) {
        throw new ForbiddenException();
      }
      return this.sanitize(branch);
    }
    this.assertOrgAccess(user, branch.organizationId);
    return this.sanitize(branch);
  }

  /** Returns branch with decrypted password for internal MQTT use only */
  async findOneWithSecrets(id: string) {
    return this.branches.findOne({ where: { id } });
  }

  async update(id: string, dto: UpdateBranchDto, user: JwtPayload) {
    const branch = await this.branches.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    this.assertOrgAccess(user, branch.organizationId);
    if (dto.name !== undefined) {
      branch.name = dto.name;
    }
    if (dto.code !== undefined) {
      branch.code = dto.code;
    }
    if (dto.mqttUrl !== undefined) {
      branch.mqttUrl = dto.mqttUrl;
    }
    if (dto.mqttUsername !== undefined) {
      branch.mqttUsername = dto.mqttUsername;
    }
    if (dto.mqttPassword !== undefined && dto.mqttPassword !== '') {
      branch.mqttPasswordEncrypted = this.encryption.encrypt(dto.mqttPassword);
    }
    if (dto.mqttTopic !== undefined) {
      branch.mqttTopic = dto.mqttTopic;
    }
    if (dto.isVip !== undefined) {
      branch.isVip = dto.isVip;
    }
    if (dto.isBlocked !== undefined) {
      branch.isBlocked = dto.isBlocked;
      if (dto.isBlocked) {
        branch.blockedAt = new Date();
        if (dto.blockedReason !== undefined) {
          branch.blockedReason = dto.blockedReason ?? null;
        }
      } else {
        branch.blockedAt = null;
        branch.blockedReason = null;
      }
    } else if (dto.blockedReason !== undefined && branch.isBlocked) {
      branch.blockedReason = dto.blockedReason ?? null;
    }
    const saved = await this.branches.save(branch);
    return this.sanitize(saved);
  }

  async remove(id: string, user: JwtPayload) {
    const branch = await this.branches.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    this.assertOrgAccess(user, branch.organizationId);
    await this.dataSource.transaction(async (em) => {
      const apartments = await em
        .getRepository(Apartment)
        .createQueryBuilder('a')
        .innerJoin('a.floor', 'f')
        .innerJoin('f.block', 'b')
        .where('b.branchId = :bid', { bid: id })
        .select(['a.id'])
        .getMany();
      const aptIds = apartments.map((a) => a.id);
      if (aptIds.length > 0) {
        await em.getRepository(Contract).delete({ apartmentId: In(aptIds) });
      }
      await em.getRepository(Branch).delete(id);
    });
    return { deleted: true };
  }

  private sanitize(b: Branch): Omit<Branch, 'mqttPasswordEncrypted'> {
    const { mqttPasswordEncrypted: _omit, ...rest } = b;
    void _omit;
    return rest;
  }
}
