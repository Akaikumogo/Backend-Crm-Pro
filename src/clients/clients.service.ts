import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Client } from '../entities/client.entity';
import { UserRole } from '../user-role.enum';
import { BulkDeleteClientsDto } from './dto/bulk-delete-clients.dto';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clients: Repository<Client>,
  ) {}

  private orgIdForActor(actor: JwtPayload): string | null {
    if (actor.role === UserRole.SUPERADMIN) {
      return null;
    }
    return actor.organizationId;
  }

  assertOrg(actor: JwtPayload, organizationId: string) {
    if (actor.role === UserRole.SUPERADMIN) {
      return;
    }
    if (actor.organizationId !== organizationId) {
      throw new ForbiddenException();
    }
  }

  async create(
    dto: CreateClientDto,
    organizationId: string,
    actor: JwtPayload,
  ) {
    this.assertOrg(actor, organizationId);
    return this.clients.save(
      this.clients.create({
        fullName: dto.fullName,
        phone: dto.phone,
        organizationId,
      }),
    );
  }

  async findAll(
    actor: JwtPayload,
    organizationId: string | undefined,
    skip = 0,
    take = 50,
  ) {
    if (actor.role !== UserRole.SUPERADMIN) {
      organizationId = actor.organizationId ?? undefined;
    }
    if (!organizationId) {
      if (actor.role === UserRole.SUPERADMIN) {
        return this.clients.find({
          order: { createdAt: 'DESC' },
          skip,
          take,
        });
      }
      return [];
    }
    this.assertOrg(actor, organizationId);
    return this.clients.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  async findOne(id: string, actor: JwtPayload) {
    const c = await this.clients.findOne({ where: { id } });
    if (!c) {
      throw new NotFoundException();
    }
    this.assertOrg(actor, c.organizationId);
    return c;
  }

  async bulkRemove(dto: BulkDeleteClientsDto, actor: JwtPayload) {
    if (dto.deleteAllInScope) {
      if (actor.role === UserRole.SUPERADMIN) {
        if (dto.organizationId) {
          this.assertOrg(actor, dto.organizationId);
          const res = await this.clients.delete({
            organizationId: dto.organizationId,
          });
          return { deleted: res.affected ?? 0 };
        }
        const res = await this.clients.createQueryBuilder().delete().execute();
        return { deleted: res.affected ?? 0 };
      }
      if (actor.role === UserRole.ORG_ADMIN && actor.organizationId) {
        const res = await this.clients.delete({
          organizationId: actor.organizationId,
        });
        return { deleted: res.affected ?? 0 };
      }
      throw new ForbiddenException();
    }
    if (!dto.ids?.length) {
      throw new ForbiddenException();
    }
    return this.removeMany(dto.ids, actor);
  }

  async removeMany(ids: string[], actor: JwtPayload) {
    const rows = await this.clients.find({ where: { id: In(ids) } });
    for (const c of rows) {
      this.assertOrg(actor, c.organizationId);
    }
    if (!rows.length) {
      return { deleted: 0 };
    }
    const res = await this.clients.delete(ids);
    return { deleted: res.affected ?? 0 };
  }

  async removeOne(id: string, actor: JwtPayload) {
    return this.removeMany([id], actor);
  }
}
