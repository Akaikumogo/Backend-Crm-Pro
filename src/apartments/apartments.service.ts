import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccessService } from '../access/access.service';
import {
  compareApartmentNumberStrings,
  sortApartmentsByNumber,
} from '../common/apartment-number-sort';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ApartmentStatus } from '../apartment-status.enum';
import { Apartment } from '../entities/apartment.entity';
import { Block } from '../entities/block.entity';
import { Contract } from '../entities/contract.entity';
import { Floor } from '../entities/floor.entity';
import { User } from '../entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UserRole } from '../user-role.enum';
import { BulkCreateApartmentsOnFloorDto } from './dto/bulk-create-apartments-on-floor.dto';
import { BulkDeleteApartmentsDto } from './dto/bulk-delete-apartments.dto';
import { ChangeApartmentStatusDto } from './dto/change-apartment-status.dto';
import { CopyApartmentsFromFloorDto } from './dto/copy-apartments-from-floor.dto';
import { CreateApartmentDto } from './dto/create-apartment.dto';
import { UpdateApartmentDto } from './dto/update-apartment.dto';

@Injectable()
export class ApartmentsService {
  constructor(
    @InjectRepository(Apartment)
    private readonly apartments: Repository<Apartment>,
    @InjectRepository(Floor)
    private readonly floors: Repository<Floor>,
    @InjectRepository(Block)
    private readonly blocks: Repository<Block>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly access: AccessService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(dto: CreateApartmentDto, user: JwtPayload) {
    const floor = await this.floors.findOne({
      where: { id: dto.floorId },
      relations: { block: true },
    });
    if (!floor) {
      throw new UnprocessableEntityException(`Floor ${dto.floorId} not found`);
    }
    await this.access.assertBranchWrite(user, floor.block.branchId);
    const apartment = this.apartments.create({
      floorId: dto.floorId,
      number: dto.number,
      status: dto.status ?? ApartmentStatus.FOR_SALE,
      areaSqm: dto.areaSqm !== undefined ? String(dto.areaSqm) : null,
      rooms: dto.rooms ?? null,
      priceTotal: dto.priceTotal !== undefined ? String(dto.priceTotal) : null,
      pricePerSqm:
        dto.pricePerSqm !== undefined ? String(dto.pricePerSqm) : null,
      imageUrl: dto.imageUrl ?? null,
    });
    return this.apartments.save(apartment);
  }

  async bulkCreateOnFloor(
    dto: BulkCreateApartmentsOnFloorDto,
    user: JwtPayload,
  ) {
    const floor = await this.floors.findOne({
      where: { id: dto.floorId },
      relations: { block: true },
    });
    if (!floor) {
      throw new NotFoundException('Floor not found');
    }
    await this.access.assertBranchWrite(user, floor.block.branchId);
    const existingRows = await this.apartments.find({
      where: { floorId: dto.floorId },
      select: { number: true },
    });
    const numbers = this.allocateFreeNumericApartmentNumbers(
      existingRows.map((r) => r.number),
      dto.count,
    );
    const branchId = floor.block.branchId;
    const savedIds: string[] = [];
    await this.apartments.manager.transaction(async (em) => {
      const repo = em.getRepository(Apartment);
      for (const number of numbers) {
        const row = repo.create({
          floorId: dto.floorId,
          number,
          status: ApartmentStatus.FOR_SALE,
          areaSqm: null,
          rooms: null,
          priceTotal: null,
          pricePerSqm: null,
          imageUrl: null,
        });
        await repo.save(row);
        savedIds.push(row.id);
      }
    });
    for (const id of savedIds) {
      this.realtime.emitApartmentUpdated(branchId, {
        apartmentId: id,
        status: ApartmentStatus.FOR_SALE,
      });
    }
    return { created: savedIds.length };
  }

  private allocateFreeNumericApartmentNumbers(
    existingNumbers: string[],
    count: number,
  ): string[] {
    const used = new Set(existingNumbers.map((x) => x.trim()));
    let maxNum = 0;
    for (const x of used) {
      if (/^\d+$/.test(x)) {
        const v = parseInt(x, 10);
        if (Number.isSafeInteger(v) && v > maxNum) {
          maxNum = v;
        }
      }
    }
    const out: string[] = [];
    let c = maxNum + 1;
    const cap = maxNum + count + 100000;
    while (out.length < count && c <= cap) {
      const s = String(c);
      if (!used.has(s)) {
        out.push(s);
        used.add(s);
      }
      c += 1;
    }
    if (out.length < count) {
      throw new UnprocessableEntityException(
        'Bu qavatda bo‘sh raqam topilmadi — qo‘shib bo‘lmadi',
      );
    }
    return out;
  }

  async findByFloor(floorId: string, user: JwtPayload) {
    const floor = await this.floors.findOne({
      where: { id: floorId },
      relations: { block: true },
    });
    if (!floor) {
      throw new NotFoundException('Floor not found');
    }
    await this.access.assertBranchRead(user, floor.block.branchId);
    const rows = await this.apartments.find({
      where: { floorId },
    });
    return sortApartmentsByNumber(rows);
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
    const floorRows = await this.floors.find({
      where: { blockId: In(blockIds) },
      select: { id: true },
    });
    const floorIds = floorRows.map((f) => f.id);
    if (!floorIds.length) {
      return [];
    }
    const rows = await this.apartments.find({
      where: { floorId: In(floorIds) },
    });
    return rows.sort((a, b) => {
      if (a.floorId !== b.floorId) {
        return a.floorId.localeCompare(b.floorId);
      }
      return compareApartmentNumberStrings(a.number, b.number);
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const apartment = await this.apartments.findOne({
      where: { id },
      relations: { floor: { block: true } },
    });
    if (!apartment) {
      throw new NotFoundException(`Apartment ${id} not found`);
    }
    await this.access.assertBranchRead(user, apartment.floor.block.branchId);
    return apartment;
  }

  async changeStatus(
    id: string,
    dto: ChangeApartmentStatusDto,
    user: JwtPayload,
  ) {
    const apartment = await this.apartments.findOne({
      where: { id },
      relations: { floor: { block: true } },
    });
    if (!apartment) {
      throw new NotFoundException(`Apartment ${id} not found`);
    }
    const branchId = apartment.floor.block.branchId;
    await this.access.assertBranchWrite(user, branchId);

    let soldById: string | null = apartment.soldById ?? null;
    if (dto.status === ApartmentStatus.SOLD) {
      let sellerId = dto.sellerId ?? null;
      if (user.role === UserRole.STAFF) {
        if (sellerId && sellerId !== user.sub) {
          throw new BadRequestException('Staff may only sell as themselves');
        }
        sellerId = user.sub;
      } else if (sellerId) {
        const seller = await this.users.findOne({ where: { id: sellerId } });
        if (!seller || seller.organizationId !== user.organizationId) {
          throw new BadRequestException('Invalid seller');
        }
      }
      soldById = sellerId;
    } else {
      soldById = null;
    }

    apartment.status = dto.status;
    apartment.soldById = soldById;
    const saved = await this.apartments.save(apartment);
    this.realtime.emitApartmentUpdated(branchId, {
      apartmentId: saved.id,
      status: saved.status,
    });
    return saved;
  }

  async update(id: string, dto: UpdateApartmentDto, user: JwtPayload) {
    const apartment = await this.apartments.findOne({
      where: { id },
      relations: { floor: { block: true } },
    });
    if (!apartment) {
      throw new NotFoundException(`Apartment ${id} not found`);
    }
    const branchId = apartment.floor.block.branchId;
    await this.access.assertBranchWrite(user, branchId);
    if (dto.number !== undefined && dto.number !== apartment.number) {
      const taken = await this.apartments.exist({
        where: { floorId: apartment.floorId, number: dto.number },
      });
      if (taken) {
        throw new UnprocessableEntityException(
          `Apartment number "${dto.number}" already exists on this floor`,
        );
      }
      apartment.number = dto.number;
    }
    if (dto.status !== undefined) {
      apartment.status = dto.status;
    }
    if (dto.areaSqm !== undefined) {
      apartment.areaSqm = dto.areaSqm === null ? null : String(dto.areaSqm);
    }
    if (dto.rooms !== undefined) {
      apartment.rooms = dto.rooms;
    }
    if (dto.priceTotal !== undefined) {
      apartment.priceTotal =
        dto.priceTotal === null ? null : String(dto.priceTotal);
    }
    if (dto.pricePerSqm !== undefined) {
      apartment.pricePerSqm =
        dto.pricePerSqm === null ? null : String(dto.pricePerSqm);
    }
    if (dto.imageUrl !== undefined) {
      apartment.imageUrl = dto.imageUrl;
    }
    const saved = await this.apartments.save(apartment);
    this.realtime.emitApartmentUpdated(branchId, {
      apartmentId: saved.id,
      status: saved.status,
    });
    return saved;
  }

  async remove(id: string, user: JwtPayload) {
    const apartment = await this.apartments.findOne({
      where: { id },
      relations: { floor: { block: true } },
    });
    if (!apartment) {
      throw new NotFoundException(`Apartment ${id} not found`);
    }
    const branchId = apartment.floor.block.branchId;
    await this.access.assertBranchWrite(user, branchId);
    const contractCount = await this.contracts.count({
      where: { apartmentId: id },
    });
    if (contractCount > 0) {
      throw new ConflictException(
        'Cannot delete apartment: contracts reference this unit',
      );
    }
    const lastStatus = apartment.status;
    await this.apartments.delete(id);
    this.realtime.emitApartmentUpdated(branchId, {
      apartmentId: id,
      status: lastStatus,
    });
    return { deleted: true };
  }

  /**
   * Manba qavatdagi kvartiralarni bir yoki bir nechta qavatlarga nusxalaydi.
   * Faqat butun raqamli `number` lar matematik jihatdan siljiydi: + (targetLevel - sourceLevel) * multiplier.
   */
  async copyFromFloor(dto: CopyApartmentsFromFloorDto, user: JwtPayload) {
    const multiplier = dto.levelMultiplier ?? 100;
    const source = await this.floors.findOne({
      where: { id: dto.sourceFloorId },
      relations: { block: true, apartments: true },
    });
    if (!source) {
      throw new NotFoundException('Manba qavat topilmadi');
    }
    await this.access.assertBranchWrite(user, source.block.branchId);
    const sourceApts = sortApartmentsByNumber(source.apartments);
    const targetIds = [...new Set(dto.targetFloorIds)].filter(
      (id) => id !== dto.sourceFloorId,
    );
    if (!targetIds.length) {
      throw new BadRequestException(
        'Kamida bitta boshqa qavat tanlang (manba o‘zi hisoblanmaydi)',
      );
    }
    const targets = await this.floors.find({
      where: { id: In(targetIds) },
      relations: { block: true },
    });
    if (targets.length !== targetIds.length) {
      throw new NotFoundException('Ba’zi qavatlar topilmadi');
    }
    for (const t of targets) {
      if (t.blockId !== source.blockId) {
        throw new BadRequestException(
          'Barcha qavatlar manba bilan bir xil blokda bo‘lishi kerak',
        );
      }
      await this.access.assertBranchWrite(user, t.block.branchId);
    }

    let created = 0;
    let skippedNonNumeric = 0;
    let skippedConflict = 0;

    for (const target of targets) {
      const levelDelta = target.level - source.level;
      for (const apt of sourceApts) {
        const transformed = this.transformNumberForFloorCopy(
          apt.number,
          levelDelta,
          multiplier,
        );
        if (!transformed) {
          skippedNonNumeric += 1;
          continue;
        }
        const exists = await this.apartments.exist({
          where: { floorId: target.id, number: transformed },
        });
        if (exists) {
          skippedConflict += 1;
          continue;
        }
        const row = this.apartments.create({
          floorId: target.id,
          number: transformed,
          status: apt.status,
          areaSqm: apt.areaSqm,
          rooms: apt.rooms,
          priceTotal: apt.priceTotal,
          pricePerSqm: apt.pricePerSqm,
          imageUrl: apt.imageUrl,
        });
        await this.apartments.save(row);
        created += 1;
        this.realtime.emitApartmentUpdated(target.block.branchId, {
          apartmentId: row.id,
          status: row.status,
        });
      }
    }

    return {
      created,
      skippedNonNumeric,
      skippedConflict,
      targetsProcessed: targets.length,
      sourceApartments: sourceApts.length,
    };
  }

  /** Butun raqamli satr uchun: raqam + levelDelta * multiplier */
  private transformNumberForFloorCopy(
    numberStr: string,
    levelDelta: number,
    multiplier: number,
  ): string | null {
    const t = numberStr.trim();
    if (!/^\d+$/.test(t)) {
      return null;
    }
    const n = parseInt(t, 10);
    if (!Number.isSafeInteger(n)) {
      return null;
    }
    const next = n + levelDelta * multiplier;
    if (next < 0) {
      return null;
    }
    return String(next);
  }

  async bulkRemove(dto: BulkDeleteApartmentsDto, user: JwtPayload) {
    if (dto.deleteAllInScope) {
      const list = dto.floorId
        ? await this.findByFloor(dto.floorId, user)
        : await this.findAll(user);
      return this.removeManyByIds(
        list.map((a) => a.id),
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
