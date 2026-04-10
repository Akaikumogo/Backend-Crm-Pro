import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccessService } from '../access/access.service';
import {
  sortApartmentsByNumber,
  sortFloorsApartmentsInPlace,
} from '../common/apartment-number-sort';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Apartment } from '../entities/apartment.entity';
import { Block } from '../entities/block.entity';
import { Floor, FloorHotspot } from '../entities/floor.entity';
import { BulkAssignBlocksBranchDto } from './dto/bulk-assign-blocks-branch.dto';
import { BulkDeleteBlocksDto } from './dto/bulk-delete-blocks.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { DuplicateBlockDto } from './dto/duplicate-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

@Injectable()
export class BlocksService {
  constructor(
    @InjectRepository(Block)
    private readonly blocks: Repository<Block>,
    private readonly access: AccessService,
  ) {}

  async create(dto: CreateBlockDto, user: JwtPayload) {
    await this.access.assertBranchWrite(user, dto.branchId);
    const block = this.blocks.create(dto);
    return this.blocks.save(block);
  }

  async findAll(user: JwtPayload) {
    const branchIds = await this.access.listAccessibleBranchIds(user);
    if (!branchIds.length) {
      return [];
    }
    return this.blocks.find({
      where: { branchId: In(branchIds) },
      order: { branchId: 'ASC', code: 'ASC' },
    });
  }

  async duplicate(id: string, dto: DuplicateBlockDto, user: JwtPayload) {
    const source = await this.blocks.findOne({
      where: { id },
      relations: { floors: { apartments: true } },
      order: {
        floors: { level: 'ASC', apartments: { number: 'ASC' } },
      },
    });
    if (!source) {
      throw new NotFoundException(`Block ${id} not found`);
    }
    await this.access.assertBranchWrite(user, source.branchId);

    return this.blocks.manager.transaction(async (em) => {
      const blockRepo = em.getRepository(Block);
      const floorRepo = em.getRepository(Floor);
      const aptRepo = em.getRepository(Apartment);

      const existsCode = (code: string) =>
        blockRepo.exist({ where: { branchId: source.branchId, code } });

      let code = dto.code?.trim();
      if (!code) {
        code = await this.pickUniqueCopyCode(source.code, existsCode);
      } else if (await existsCode(code)) {
        throw new UnprocessableEntityException(
          `Block code "${code}" already exists in this branch`,
        );
      }

      const newBlock = blockRepo.create({
        branchId: source.branchId,
        code,
        name: dto.name.trim(),
      });
      await blockRepo.save(newBlock);

      const floors = [...(source.floors ?? [])].sort(
        (a, b) => a.level - b.level,
      );

      for (const floor of floors) {
        const newFloor = floorRepo.create({
          blockId: newBlock.id,
          level: floor.level,
          name: floor.name,
          planImageUrl: floor.planImageUrl,
          hotspots: null,
        });
        await floorRepo.save(newFloor);

        const aptIdMap = new Map<string, string>();
        const apts = sortApartmentsByNumber(floor.apartments);

        for (const apt of apts) {
          const row = aptRepo.create({
            floorId: newFloor.id,
            number: apt.number,
            status: apt.status,
            areaSqm: apt.areaSqm,
            rooms: apt.rooms,
            priceTotal: apt.priceTotal,
            pricePerSqm: apt.pricePerSqm,
            imageUrl: apt.imageUrl,
          });
          const saved = await aptRepo.save(row);
          aptIdMap.set(apt.id, saved.id);
        }

        let hotspots: FloorHotspot[] | null = floor.hotspots;
        if (hotspots?.length) {
          hotspots = hotspots.map((h) => ({
            ...h,
            apartmentId: aptIdMap.get(h.apartmentId) ?? h.apartmentId,
          }));
        }
        newFloor.hotspots = hotspots;
        await floorRepo.save(newFloor);
      }

      const created = await blockRepo.findOne({
        where: { id: newBlock.id },
        relations: { floors: { apartments: true }, branch: true },
        order: {
          floors: { level: 'ASC', apartments: { number: 'ASC' } },
        },
      });
      if (created?.floors) {
        sortFloorsApartmentsInPlace(created.floors);
      }
      return created;
    });
  }

  private async pickUniqueCopyCode(
    baseCode: string,
    exists: (code: string) => Promise<boolean>,
  ): Promise<string> {
    for (let i = 0; i < 1000; i++) {
      const suffix = i === 0 ? '-copy' : `-copy${i + 1}`;
      const candidate = this.fitBlockCode(baseCode, suffix);
      if (!(await exists(candidate))) {
        return candidate;
      }
    }
    throw new UnprocessableEntityException(
      'Could not generate a unique block code',
    );
  }

  private fitBlockCode(base: string, suffix: string): string {
    const max = 32;
    if (base.length + suffix.length <= max) {
      return base + suffix;
    }
    return (base.slice(0, Math.max(1, max - suffix.length)) + suffix).slice(
      0,
      max,
    );
  }

  async findOne(id: string, user: JwtPayload) {
    const block = await this.blocks.findOne({
      where: { id },
      relations: { floors: { apartments: true }, branch: true },
      order: {
        floors: { level: 'ASC', apartments: { number: 'ASC' } },
      },
    });
    if (!block) {
      throw new NotFoundException(`Block ${id} not found`);
    }
    await this.access.assertBranchRead(user, block.branchId);
    sortFloorsApartmentsInPlace(block.floors);
    return block;
  }

  async update(id: string, dto: UpdateBlockDto, user: JwtPayload) {
    const block = await this.blocks.findOne({ where: { id } });
    if (!block) {
      throw new NotFoundException(`Block ${id} not found`);
    }
    await this.access.assertBranchWrite(user, block.branchId);
    if (dto.code !== undefined && dto.code !== block.code) {
      const taken = await this.blocks.exist({
        where: { branchId: block.branchId, code: dto.code },
      });
      if (taken) {
        throw new UnprocessableEntityException(
          `Block code "${dto.code}" already exists in this branch`,
        );
      }
      block.code = dto.code;
    }
    if (dto.name !== undefined) {
      block.name = dto.name;
    }
    return this.blocks.save(block);
  }

  async remove(id: string, user: JwtPayload) {
    const block = await this.blocks.findOne({ where: { id } });
    if (!block) {
      throw new NotFoundException(`Block ${id} not found`);
    }
    await this.access.assertBranchWrite(user, block.branchId);
    try {
      await this.blocks.delete(id);
    } catch {
      throw new ConflictException(
        'Cannot delete block: related apartments may have contracts',
      );
    }
    return { deleted: true };
  }

  async bulkRemove(dto: BulkDeleteBlocksDto, user: JwtPayload) {
    if (dto.deleteAllInScope) {
      let list = await this.findAll(user);
      if (dto.branchId) {
        await this.access.assertBranchWrite(user, dto.branchId);
        list = list.filter((b) => b.branchId === dto.branchId);
      }
      return this.removeManyByIds(
        list.map((b) => b.id),
        user,
      );
    }
    return this.removeManyByIds(dto.ids!, user);
  }

  async bulkAssignBranch(dto: BulkAssignBlocksBranchDto, user: JwtPayload) {
    await this.access.assertBranchWrite(user, dto.targetBranchId);
    const targetBranchId = dto.targetBranchId;

    let updated = 0;
    let skipped = 0;

    await this.blocks.manager.transaction(async (em) => {
      const repo = em.getRepository(Block);

      for (const id of dto.ids) {
        const block = await repo.findOne({ where: { id } });
        if (!block) {
          skipped += 1;
          continue;
        }
        await this.access.assertBranchWrite(user, block.branchId);

        if (block.branchId === targetBranchId) {
          skipped += 1;
          continue;
        }

        const taken = await repo.exist({
          where: { branchId: targetBranchId, code: block.code },
        });
        if (taken) {
          skipped += 1;
          continue;
        }

        block.branchId = targetBranchId;
        await repo.save(block);
        updated += 1;
      }
    });

    return { updated, skipped };
  }

  private async removeManyByIds(ids: string[], user: JwtPayload) {
    let deleted = 0;
    let skipped = 0;
    for (const id of ids) {
      try {
        await this.remove(id, user);
        deleted += 1;
      } catch {
        skipped += 1;
      }
    }
    return { deleted, skipped };
  }
}
