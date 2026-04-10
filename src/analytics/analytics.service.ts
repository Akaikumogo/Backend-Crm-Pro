import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ApartmentStatus } from '../apartment-status.enum';
import { Apartment } from '../entities/apartment.entity';
import { Block } from '../entities/block.entity';
import { Branch } from '../entities/branch.entity';
import { Floor } from '../entities/floor.entity';
import { UserRole } from '../user-role.enum';

export type BranchOverviewRow = {
  branchId: string;
  name: string;
  code: string | null;
  isVip: boolean;
  isBlocked: boolean;
  forSale: number;
  reserved: number;
  sold: number;
  total: number;
};

export type SuperadminInventoryRow = {
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchName: string;
  branchCode: string | null;
  blocks: number;
  floors: number;
  apartments: number;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    @InjectRepository(Apartment)
    private readonly apartments: Repository<Apartment>,
    @InjectRepository(Block)
    private readonly blocks: Repository<Block>,
    @InjectRepository(Floor)
    private readonly floors: Repository<Floor>,
  ) {}

  private mapBranchCounts(
    rows: { branchId: string; cnt: string }[],
  ): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.branchId, parseInt(r.cnt, 10) || 0);
    }
    return m;
  }

  async superadminInventory(): Promise<SuperadminInventoryRow[]> {
    const branchRows = await this.branches
      .createQueryBuilder('br')
      .leftJoinAndSelect('br.organization', 'o')
      .orderBy('o.name', 'ASC')
      .addOrderBy('br.name', 'ASC')
      .getMany();

    const blockRaw = await this.blocks
      .createQueryBuilder('bl')
      .select('bl.branchId', 'branchId')
      .addSelect('COUNT(bl.id)', 'cnt')
      .groupBy('bl.branchId')
      .getRawMany<{ branchId: string; cnt: string }>();

    const floorRaw = await this.floors
      .createQueryBuilder('f')
      .innerJoin('f.block', 'bl')
      .select('bl.branchId', 'branchId')
      .addSelect('COUNT(f.id)', 'cnt')
      .groupBy('bl.branchId')
      .getRawMany<{ branchId: string; cnt: string }>();

    const aptRaw = await this.apartments
      .createQueryBuilder('a')
      .innerJoin('a.floor', 'f')
      .innerJoin('f.block', 'bl')
      .select('bl.branchId', 'branchId')
      .addSelect('COUNT(a.id)', 'cnt')
      .groupBy('bl.branchId')
      .getRawMany<{ branchId: string; cnt: string }>();

    const blockMap = this.mapBranchCounts(blockRaw);
    const floorMap = this.mapBranchCounts(floorRaw);
    const aptMap = this.mapBranchCounts(aptRaw);

    return branchRows.map((br) => ({
      organizationId: br.organizationId,
      organizationName: br.organization?.name ?? '—',
      branchId: br.id,
      branchName: br.name,
      branchCode: br.code,
      blocks: blockMap.get(br.id) ?? 0,
      floors: floorMap.get(br.id) ?? 0,
      apartments: aptMap.get(br.id) ?? 0,
    }));
  }

  async overview(user: JwtPayload): Promise<BranchOverviewRow[]> {
    let branchIds: string[] = [];
    if (user.role === UserRole.SUPERADMIN) {
      const rows = await this.branches.find({
        select: { id: true },
        order: { name: 'ASC' },
      });
      branchIds = rows.map((r) => r.id);
    } else if (user.role === UserRole.ORG_ADMIN && user.organizationId) {
      const rows = await this.branches.find({
        where: { organizationId: user.organizationId },
        select: { id: true },
        order: { name: 'ASC' },
      });
      branchIds = rows.map((r) => r.id);
    } else if (user.role === UserRole.STAFF && user.branchId) {
      branchIds = [user.branchId];
    } else {
      throw new ForbiddenException();
    }
    if (!branchIds.length) {
      return [];
    }
    const branches = await this.branches.find({
      where: { id: In(branchIds) },
      order: { name: 'ASC' },
    });
    const counts = await this.apartments
      .createQueryBuilder('a')
      .innerJoin('a.floor', 'f')
      .innerJoin('f.block', 'bl')
      .where('bl.branchId IN (:...ids)', { ids: branchIds })
      .select('bl.branchId', 'branchId')
      .addSelect('a.status', 'status')
      .addSelect('COUNT(a.id)', 'cnt')
      .groupBy('bl.branchId')
      .addGroupBy('a.status')
      .getRawMany<{ branchId: string; status: ApartmentStatus; cnt: string }>();

    const map = new Map<
      string,
      { forSale: number; reserved: number; sold: number }
    >();
    for (const id of branchIds) {
      map.set(id, { forSale: 0, reserved: 0, sold: 0 });
    }
    for (const row of counts) {
      const m = map.get(row.branchId);
      if (!m) {
        continue;
      }
      const n = parseInt(row.cnt, 10) || 0;
      if (row.status === ApartmentStatus.FOR_SALE) {
        m.forSale += n;
      } else if (row.status === ApartmentStatus.RESERVED) {
        m.reserved += n;
      } else if (row.status === ApartmentStatus.SOLD) {
        m.sold += n;
      }
    }

    return branches.map((b) => {
      const c = map.get(b.id) ?? { forSale: 0, reserved: 0, sold: 0 };
      const total = c.forSale + c.reserved + c.sold;
      return {
        branchId: b.id,
        name: b.name,
        code: b.code,
        isVip: b.isVip,
        isBlocked: b.isBlocked,
        forSale: c.forSale,
        reserved: c.reserved,
        sold: c.sold,
        total,
      };
    });
  }
}
