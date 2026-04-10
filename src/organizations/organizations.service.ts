import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Client } from '../entities/client.entity';
import { Contract } from '../entities/contract.entity';
import { OrganizationPayment } from '../entities/organization-payment.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgs: Repository<Organization>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateOrganizationDto) {
    const email = dto.adminEmail.toLowerCase().trim();
    const exists = await this.users.exist({ where: { email } });
    if (exists) {
      throw new BadRequestException('Admin email already in use');
    }
    return this.dataSource.transaction(async (em) => {
      const orgRepo = em.getRepository(Organization);
      const userRepo = em.getRepository(User);
      const org = await orgRepo.save(
        orgRepo.create({
          name: dto.name,
          isBlocked: false,
          blockedAt: null,
          blockedReason: null,
          isVip: false,
          paymentDueAt: null,
          lastNotifiedPaymentDueAt: null,
        }),
      );
      const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
      await userRepo.save(
        userRepo.create({
          email,
          passwordHash,
          role: UserRole.ORG_ADMIN,
          fullName: dto.adminFullName ?? null,
          organizationId: org.id,
          branchId: null,
        }),
      );
      return orgRepo.findOne({ where: { id: org.id } });
    });
  }

  findAll(blockedOnly?: boolean) {
    const qb = this.orgs.createQueryBuilder('o').orderBy('o.name', 'ASC');
    if (blockedOnly === true) {
      qb.andWhere('o.isBlocked = true');
    }
    return qb.getMany();
  }

  async findOne(id: string, user: JwtPayload) {
    if (user.role === UserRole.ORG_ADMIN && user.organizationId !== id) {
      throw new NotFoundException();
    }
    const org = await this.orgs.findOne({
      where: { id },
      relations: { branches: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.orgs.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    if (dto.name !== undefined) {
      org.name = dto.name;
    }
    if (dto.isVip !== undefined) {
      org.isVip = dto.isVip;
    }
    if (dto.paymentDueAt !== undefined) {
      const next =
        dto.paymentDueAt === null || dto.paymentDueAt === ''
          ? null
          : dto.paymentDueAt.slice(0, 10);
      if (next !== org.paymentDueAt) {
        org.lastNotifiedPaymentDueAt = null;
      }
      org.paymentDueAt = next;
    }
    if (dto.isBlocked !== undefined) {
      org.isBlocked = dto.isBlocked;
      if (dto.isBlocked) {
        org.blockedAt = new Date();
        if (dto.blockedReason !== undefined) {
          org.blockedReason = dto.blockedReason ?? null;
        }
      } else {
        org.blockedAt = null;
        org.blockedReason = null;
      }
    } else if (dto.blockedReason !== undefined && org.isBlocked) {
      org.blockedReason = dto.blockedReason ?? null;
    }
    return this.orgs.save(org);
  }

  /**
   * Superadmin: remove org and dependent rows (contracts first — apartment FK).
   */
  async remove(id: string) {
    const org = await this.orgs.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    await this.dataSource.transaction(async (em) => {
      await em.getRepository(Contract).delete({ organizationId: id });
      await em.getRepository(Client).delete({ organizationId: id });
      await em.getRepository(User).delete({ organizationId: id });
      await em.getRepository(OrganizationPayment).delete({
        organizationId: id,
      });
      await em.getRepository(Organization).delete({ id });
    });
    return { deleted: true };
  }
}
