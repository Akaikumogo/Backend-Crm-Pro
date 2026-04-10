import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationPayment } from '../entities/organization-payment.entity';
import { CreateOrganizationPaymentDto } from './dto/create-organization-payment.dto';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@Injectable()
export class AdminPaymentsService {
  constructor(
    @InjectRepository(OrganizationPayment)
    private readonly payments: Repository<OrganizationPayment>,
  ) {}

  async findAll(organizationId?: string) {
    const qb = this.payments
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.organization', 'o')
      .orderBy('p.paidAt', 'DESC')
      .addOrderBy('p.createdAt', 'DESC');
    if (organizationId) {
      qb.andWhere('p.organizationId = :oid', { oid: organizationId });
    }
    return qb.getMany();
  }

  async create(dto: CreateOrganizationPaymentDto, actor: JwtPayload) {
    const row = this.payments.create({
      organizationId: dto.organizationId,
      amount: String(dto.amount),
      paidAt: dto.paidAt.slice(0, 10),
      note: dto.note ?? null,
      createdByUserId: actor.sub,
    });
    return this.payments.save(row);
  }

  async remove(id: string) {
    const res = await this.payments.delete(id);
    if (!res.affected) {
      return { deleted: false };
    }
    return { deleted: true };
  }
}
