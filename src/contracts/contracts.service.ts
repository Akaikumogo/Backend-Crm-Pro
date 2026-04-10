import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ApartmentStatus } from '../apartment-status.enum';
import { ContractStatus, PaymentStatus } from '../contract-status.enum';
import { Apartment } from '../entities/apartment.entity';
import { Client } from '../entities/client.entity';
import { Contract } from '../entities/contract.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { BulkDeleteContractsDto } from './dto/bulk-delete-contracts.dto';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Apartment)
    private readonly apartments: Repository<Apartment>,
    @InjectRepository(Client)
    private readonly clients: Repository<Client>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private assertContractAccess(
    actor: JwtPayload,
    organizationId: string,
    branchId: string,
  ) {
    if (actor.role === UserRole.SUPERADMIN) {
      return;
    }
    if (actor.organizationId !== organizationId) {
      throw new ForbiddenException();
    }
    if (actor.role === UserRole.STAFF && actor.branchId !== branchId) {
      throw new ForbiddenException();
    }
  }

  async create(dto: CreateContractDto, actor: JwtPayload) {
    const apt = await this.apartments.findOne({
      where: { id: dto.apartmentId },
      relations: { floor: { block: { branch: true } } },
    });
    if (!apt) {
      throw new NotFoundException('Apartment not found');
    }
    if (apt.status === ApartmentStatus.NOT_FOR_SALE) {
      throw new BadRequestException(
        'Sotuv uchun emas belgilangan kvartira bo‘yicha shartnoma ochilmaydi',
      );
    }
    const branchId = apt.floor.block.branchId;
    const orgId = apt.floor.block.branch.organizationId;
    this.assertContractAccess(actor, orgId, branchId);

    const client = await this.clients.findOne({
      where: { id: dto.clientId },
    });
    if (!client || client.organizationId !== orgId) {
      throw new BadRequestException(
        'Client must belong to the same organization',
      );
    }

    let sellerId = dto.sellerId ?? null;
    if (actor.role === UserRole.STAFF) {
      if (sellerId && sellerId !== actor.sub) {
        throw new BadRequestException(
          'Staff may only create contracts as themselves',
        );
      }
      sellerId = actor.sub;
    } else if (sellerId) {
      const seller = await this.users.findOne({ where: { id: sellerId } });
      if (!seller || seller.organizationId !== orgId) {
        throw new BadRequestException('Invalid seller');
      }
    }

    return this.contracts.save(
      this.contracts.create({
        apartmentId: dto.apartmentId,
        clientId: dto.clientId,
        sellerId,
        organizationId: orgId,
        contractDate: dto.contractDate.slice(0, 10),
        amount: String(dto.amount),
        status: dto.status ?? ContractStatus.PENDING,
        paymentStatus: dto.paymentStatus ?? PaymentStatus.UNPAID,
        progressPercent: dto.progressPercent ?? 0,
      }),
    );
  }

  async findAll(actor: JwtPayload, skip = 0, take = 50) {
    const qb = this.contracts
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.apartment', 'a')
      .leftJoinAndSelect('a.floor', 'f')
      .leftJoinAndSelect('f.block', 'b')
      .leftJoinAndSelect('b.branch', 'br')
      .leftJoinAndSelect('c.client', 'cl')
      .leftJoinAndSelect('c.seller', 's')
      .orderBy('c.createdAt', 'DESC')
      .skip(skip)
      .take(Math.min(take, 200));

    if (actor.role === UserRole.ORG_ADMIN && actor.organizationId) {
      qb.andWhere('c.organizationId = :oid', { oid: actor.organizationId });
    } else if (actor.role === UserRole.STAFF && actor.branchId) {
      qb.andWhere('b.branchId = :bid', { bid: actor.branchId });
      qb.andWhere('c.sellerId = :uid', { uid: actor.sub });
    } else if (actor.role !== UserRole.SUPERADMIN) {
      return [];
    }

    return qb.getMany();
  }

  /** All contract IDs visible to actor (same scope as findAll), no pagination cap. */
  private async idsInScope(
    actor: JwtPayload,
    organizationId?: string,
  ): Promise<string[]> {
    const qb = this.contracts
      .createQueryBuilder('c')
      .leftJoin('c.apartment', 'a')
      .leftJoin('a.floor', 'f')
      .leftJoin('f.block', 'b')
      .select('c.id', 'id');

    if (actor.role === UserRole.ORG_ADMIN && actor.organizationId) {
      qb.andWhere('c.organizationId = :oid', { oid: actor.organizationId });
    } else if (actor.role === UserRole.STAFF && actor.branchId) {
      qb.andWhere('b.branchId = :bid', { bid: actor.branchId });
      qb.andWhere('c.sellerId = :uid', { uid: actor.sub });
    } else if (actor.role !== UserRole.SUPERADMIN) {
      return [];
    }

    if (actor.role === UserRole.SUPERADMIN && organizationId) {
      qb.andWhere('c.organizationId = :oidf', { oidf: organizationId });
    }

    const rows = await qb.getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  async bulkRemove(dto: BulkDeleteContractsDto, actor: JwtPayload) {
    if (dto.deleteAllInScope) {
      const ids = await this.idsInScope(actor, dto.organizationId);
      return this.removeMany(ids, actor);
    }
    return this.removeMany(dto.ids!, actor);
  }

  async findOne(id: string, actor: JwtPayload) {
    const c = await this.contracts.findOne({
      where: { id },
      relations: {
        apartment: { floor: { block: { branch: true } } },
        client: true,
        seller: true,
      },
    });
    if (!c) {
      throw new NotFoundException();
    }
    const branchId = c.apartment.floor.block.branchId;
    const orgId = c.organizationId;
    this.assertContractAccess(actor, orgId, branchId);
    return c;
  }

  async removeMany(ids: string[], actor: JwtPayload) {
    const rows = await this.contracts.find({
      where: { id: In(ids) },
      relations: { apartment: { floor: { block: true } } },
    });
    for (const c of rows) {
      const branchId = c.apartment.floor.block.branchId;
      this.assertContractAccess(actor, c.organizationId, branchId);
    }
    if (!rows.length) {
      return { deleted: 0 };
    }
    const res = await this.contracts.delete(ids);
    return { deleted: res.affected ?? 0 };
  }
}
