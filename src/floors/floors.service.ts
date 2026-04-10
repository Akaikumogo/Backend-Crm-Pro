import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccessService } from '../access/access.service';
import { sortApartmentsByNumber } from '../common/apartment-number-sort';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Block } from '../entities/block.entity';
import { Floor } from '../entities/floor.entity';
import { BulkDeleteFloorsDto } from './dto/bulk-delete-floors.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';

@Injectable()
export class FloorsService {
  constructor(
    @InjectRepository(Floor)
    private readonly floors: Repository<Floor>,
    @InjectRepository(Block)
    private readonly blocks: Repository<Block>,
    private readonly access: AccessService,
  ) {}

  async create(dto: CreateFloorDto, user: JwtPayload) {
    const block = await this.blocks.findOne({ where: { id: dto.blockId } });
    if (!block) {
      throw new UnprocessableEntityException(`Block ${dto.blockId} not found`);
    }
    await this.access.assertBranchWrite(user, block.branchId);
    const exists = await this.floors.exist({
      where: { blockId: dto.blockId, level: dto.level },
    });
    if (exists) {
      throw new UnprocessableEntityException(
        `Floor level ${dto.level} already exists in this block`,
      );
    }
    const floor = this.floors.create({
      blockId: dto.blockId,
      level: dto.level,
      name: dto.name ?? null,
      planImageUrl: dto.planImageUrl ?? null,
      hotspots: dto.hotspots ?? null,
    });
    return this.floors.save(floor);
  }

  async findByBlock(blockId: string, user: JwtPayload) {
    await this.access.assertBlockInAccessibleBranch(user, blockId);
    const list = await this.floors.find({
      where: { blockId },
      order: { level: 'ASC' },
      relations: { apartments: true },
    });
    for (const f of list) {
      if (f.apartments?.length) {
        f.apartments = sortApartmentsByNumber(f.apartments);
      }
    }
    return list;
  }

  async findAll(user: JwtPayload) {
    const branchIds = await this.access.listAccessibleBranchIds(user);
    if (!branchIds.length) {
      return [];
    }
    const blockRows = await this.blocks.find({
      where: { branchId: In(branchIds) },
      select: { id: true },
    });
    const blockIds = blockRows.map((b) => b.id);
    if (!blockIds.length) {
      return [];
    }
    const list = await this.floors.find({
      where: { blockId: In(blockIds) },
      order: { blockId: 'ASC', level: 'ASC' },
      relations: { apartments: true },
    });
    for (const f of list) {
      if (f.apartments?.length) {
        f.apartments = sortApartmentsByNumber(f.apartments);
      }
    }
    return list;
  }

  async findOne(id: string, user: JwtPayload) {
    const floor = await this.floors.findOne({
      where: { id },
      relations: { block: true, apartments: true },
    });
    if (!floor) {
      throw new NotFoundException(`Floor ${id} not found`);
    }
    await this.access.assertBranchRead(user, floor.block.branchId);
    if (floor.apartments?.length) {
      floor.apartments = sortApartmentsByNumber(floor.apartments);
    }
    return floor;
  }

  async update(id: string, dto: UpdateFloorDto, user: JwtPayload) {
    const floor = await this.floors.findOne({
      where: { id },
      relations: { block: true },
    });
    if (!floor) {
      throw new NotFoundException(`Floor ${id} not found`);
    }
    await this.access.assertBranchWrite(user, floor.block.branchId);
    if (dto.level !== undefined && dto.level !== floor.level) {
      const exists = await this.floors.exist({
        where: { blockId: floor.blockId, level: dto.level },
      });
      if (exists) {
        throw new UnprocessableEntityException(
          `Floor level ${dto.level} already exists in this block`,
        );
      }
      floor.level = dto.level;
    }
    if (dto.name !== undefined) {
      floor.name = dto.name;
    }
    if (dto.planImageUrl !== undefined) {
      floor.planImageUrl = dto.planImageUrl;
    }
    if (dto.hotspots !== undefined) {
      floor.hotspots = dto.hotspots;
    }
    return this.floors.save(floor);
  }

  async remove(id: string, user: JwtPayload) {
    const floor = await this.floors.findOne({
      where: { id },
      relations: { block: true },
    });
    if (!floor) {
      throw new NotFoundException(`Floor ${id} not found`);
    }
    await this.access.assertBranchWrite(user, floor.block.branchId);
    try {
      await this.floors.delete(id);
    } catch {
      throw new ConflictException(
        'Cannot delete floor: apartments may have contracts',
      );
    }
    return { deleted: true };
  }

  async bulkRemove(dto: BulkDeleteFloorsDto, user: JwtPayload) {
    if (dto.deleteAllInScope) {
      const list = dto.blockId
        ? await this.findByBlock(dto.blockId, user)
        : await this.findAll(user);
      return this.removeManyByIds(
        list.map((f) => f.id),
        user,
      );
    }
    return this.removeManyByIds(dto.ids!, user);
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
