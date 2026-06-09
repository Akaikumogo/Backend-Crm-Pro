import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessService } from '../access/access.service';
import {
  sortApartmentsByNumber,
  sortFloorsApartmentsInPlace,
} from '../common/apartment-number-sort';
import { ApartmentStatus } from '../apartment-status.enum';
import { Apartment } from '../entities/apartment.entity';
import { Block } from '../entities/block.entity';
import { Branch } from '../entities/branch.entity';
import { Floor } from '../entities/floor.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BranchMqttService } from '../integrations/branch-mqtt.service';
import { PublicBlockTriggerDto } from './dto/public-block-trigger.dto';
import { PublicChangeApartmentStatusDto } from './dto/public-change-apartment-status.dto';
import { PublicSetApartmentSaleStatusDto } from './dto/public-set-apartment-sale-status.dto';
import { PublicShowroomMqttEventDto } from './dto/public-showroom-mqtt-event.dto';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    @InjectRepository(Block)
    private readonly blocks: Repository<Block>,
    @InjectRepository(Floor)
    private readonly floors: Repository<Floor>,
    @InjectRepository(Apartment)
    private readonly apartments: Repository<Apartment>,
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly access: AccessService,
    private readonly realtime: RealtimeGateway,
    private readonly branchMqtt: BranchMqttService,
  ) {}

  private assertShowroomToken(showroomToken?: string) {
    const expected = process.env.SHOWROOM_TOKEN;
    if (expected && showroomToken !== expected) {
      throw new ForbiddenException();
    }
  }

  async listBlocks(branchId: string) {
    await this.access.ensurePublicBranch(branchId);
    return this.blocks.find({
      where: { branchId },
      order: { code: 'ASC' },
    });
  }

  async getBlock(branchId: string, blockId: string) {
    await this.access.ensurePublicBranch(branchId);
    const block = await this.blocks.findOne({
      where: { id: blockId, branchId },
      relations: { floors: { apartments: true } },
      order: {
        floors: { level: 'ASC', apartments: { number: 'ASC' } },
      },
    });
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    sortFloorsApartmentsInPlace(block.floors);
    return block;
  }

  async getFloor(branchId: string, floorId: string) {
    await this.access.ensurePublicBranch(branchId);
    const floor = await this.floors.findOne({
      where: { id: floorId },
      relations: { block: true, apartments: true },
      order: { apartments: { number: 'ASC' } },
    });
    if (!floor || floor.block.branchId !== branchId) {
      throw new NotFoundException('Floor not found');
    }
    if (floor.apartments?.length) {
      floor.apartments = sortApartmentsByNumber(floor.apartments);
    }
    return floor;
  }

  async changeApartmentStatus(
    branchId: string,
    apartmentId: string,
    dto: PublicChangeApartmentStatusDto,
    showroomToken?: string,
  ) {
    await this.access.ensurePublicBranch(branchId);
    this.assertShowroomToken(showroomToken);
    const apt = await this.apartments.findOne({
      where: { id: apartmentId },
      relations: { floor: { block: { branch: true } } },
    });
    if (!apt || apt.floor.block.branchId !== branchId) {
      throw new NotFoundException('Apartment not found');
    }
    let soldById: string | null = null;
    if (dto.status === ApartmentStatus.SOLD) {
      if (dto.sellerId) {
        const seller = await this.users.findOne({
          where: { id: dto.sellerId },
        });
        if (
          !seller ||
          seller.role !== UserRole.STAFF ||
          seller.branchId !== branchId ||
          seller.organizationId !== apt.floor.block.branch.organizationId
        ) {
          throw new BadRequestException('Invalid seller');
        }
        soldById = seller.id;
      }
    }

    apt.status = dto.status;
    apt.soldById = soldById;
    const saved = await this.apartments.save(apt);
    this.realtime.emitApartmentUpdated(branchId, {
      apartmentId: saved.id,
      status: saved.status,
    });
    void this.publishShowroomEvent(branchId, {
      event: 'apartment_sale_status',
      apartmentId: saved.id,
      status: saved.status as ApartmentStatus.SOLD | ApartmentStatus.FOR_SALE,
    }).catch((err) => {
      this.logger.warn(
        `Showroom sale status MQTT publish failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
    });
    return saved;
  }

  async setApartmentSaleStatus(
    branchId: string,
    apartmentId: string,
    dto: PublicSetApartmentSaleStatusDto,
  ) {
    await this.access.ensurePublicBranch(branchId);
    const apt = await this.apartments.findOne({
      where: { id: apartmentId },
      relations: { floor: { block: true } },
    });
    if (!apt || apt.floor.block.branchId !== branchId) {
      throw new NotFoundException('Apartment not found');
    }

    apt.status = dto.status;
    apt.soldById = null;
    const saved = await this.apartments.save(apt);
    this.realtime.emitApartmentUpdated(branchId, {
      apartmentId: saved.id,
      status: saved.status,
    });
    return saved;
  }

  async listSellers(branchId: string, showroomToken?: string) {
    await this.access.ensurePublicBranch(branchId);
    this.assertShowroomToken(showroomToken);
    const rows = await this.users.find({
      where: { role: UserRole.STAFF, branchId },
      select: { id: true, fullName: true, email: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.fullName ?? u.email,
    }));
  }

  async publishMqtt(
    branchId: string,
    topic: string,
    data: string,
    showroomToken?: string,
  ) {
    await this.access.ensurePublicBranch(branchId);
    this.assertShowroomToken(showroomToken);
    await this.branchMqtt.publish(branchId, topic, data);
    return { ok: true };
  }

  async publishShowroomEvent(
    branchId: string,
    dto: PublicShowroomMqttEventDto,
  ) {
    await this.access.ensurePublicBranch(branchId);
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const payload = await this.buildShowroomMqttPayload(branch, dto);
    const topic = this.buildBranchTopic(branchId);
    const data = await this.buildAddressCode(branchId, {
      blockNumber: payload.address.block,
      floor: payload.address.floor,
      apartmentNumber: payload.address.apartment,
    });
    await this.branchMqtt.publish(branchId, topic, data);
    return { ok: true, topic, data, payload };
  }

  async publishCode(branchId: string, code: string) {
    await this.access.ensurePublicBranch(branchId);
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    const data = String(code ?? '').trim();
    if (!data) {
      throw new BadRequestException('code is required');
    }
    const topic = this.buildBranchTopic(branchId);
    await this.branchMqtt.publish(branchId, topic, data);
    return { ok: true, topic, data };
  }

  async publishBlockTrigger(
    dto: PublicBlockTriggerDto,
    showroomToken?: string,
  ) {
    await this.access.ensurePublicBranch(dto.branchId);
    this.assertShowroomToken(showroomToken);
    const blocks = await this.blocks.find({
      where: { branchId: dto.branchId },
      order: { code: 'ASC' },
    });
    const block = blocks[dto.blockIndex];
    if (!block) {
      throw new NotFoundException('Block not found at index');
    }
    const blockNumber = this.formatBlockNumber(block);
    const topic = this.buildBranchTopic(dto.branchId);
    const data = await this.buildAddressCode(dto.branchId, { blockNumber });
    await this.branchMqtt.publish(dto.branchId, topic, data);
    return { ok: true, topic, data };
  }

  private buildBranchTopic(branchId: string): string {
    return `${branchId}/data`;
  }

  private async buildAddressCode(
    branchId: string,
    parts: {
      blockNumber?: string | null;
      floor?: number | null;
      apartmentNumber?: string | null;
    },
  ): Promise<string> {
    const widths = await this.getBranchPadWidths(branchId);
    const segments: string[] = [];
    if (parts.blockNumber != null) {
      segments.push(this.padNumeric(parts.blockNumber, widths.block));
    }
    if (parts.floor != null) {
      segments.push(this.padNumeric(parts.floor, widths.floor));
    }
    if (parts.apartmentNumber != null && parts.floor != null) {
      const unit = this.extractApartmentUnit(parts.apartmentNumber, parts.floor);
      segments.push(this.padNumeric(unit, widths.unit));
    }
    return segments.join('');
  }

  private async getBranchPadWidths(branchId: string) {
    const blocks = await this.blocks.find({ where: { branchId } });
    const floors = await this.floors
      .createQueryBuilder('floor')
      .innerJoin('floor.block', 'block')
      .where('block.branchId = :branchId', { branchId })
      .getMany();
    const apartments = await this.apartments
      .createQueryBuilder('apt')
      .innerJoin('apt.floor', 'floor')
      .innerJoin('floor.block', 'block')
      .where('block.branchId = :branchId', { branchId })
      .leftJoinAndSelect('apt.floor', 'aptFloor')
      .getMany();
    const floorLevelById = new Map(floors.map((f) => [f.id, f.level]));

    const blockMax = blocks
      .map((b) => Number(this.formatBlockNumber(b)))
      .filter((n) => Number.isFinite(n))
      .reduce((m, n) => Math.max(m, n), 0);
    const floorMax = floors
      .map((f) => f.level)
      .reduce((m, n) => Math.max(m, n), 0);
    const unitMax = apartments
      .map((a) => {
        const level = floorLevelById.get(a.floorId) ?? null;
        return Number(this.extractApartmentUnit(a.number, level));
      })
      .filter((n) => Number.isFinite(n))
      .reduce((m, n) => Math.max(m, n), 0);

    return {
      block: String(blockMax).length || 1,
      floor: String(floorMax).length || 1,
      unit: String(unitMax).length || 1,
    };
  }

  private extractApartmentUnit(
    apartmentNumber: string,
    floor: number | null,
  ): string {
    const digits = String(apartmentNumber).match(/\d+/)?.[0] ?? '';
    if (!digits) return '';
    if (floor != null) {
      const floorStr = String(floor);
      if (digits.startsWith(floorStr) && digits.length > floorStr.length) {
        return digits.slice(floorStr.length);
      }
    }
    return digits;
  }

  private padNumeric(value: string | number, width: number): string {
    const raw = String(value).match(/\d+/)?.[0] ?? String(value);
    return raw.padStart(width, '0');
  }

  private async buildShowroomMqttPayload(
    branch: Branch,
    dto: PublicShowroomMqttEventDto,
  ) {
    let block: Block | null = null;
    let floor: Floor | null = null;
    let apartment: Apartment | null = null;

    if (dto.apartmentId) {
      apartment = await this.apartments.findOne({
        where: { id: dto.apartmentId },
        relations: { floor: { block: true } },
      });
      if (!apartment || apartment.floor.block.branchId !== branch.id) {
        throw new NotFoundException('Apartment not found');
      }
      floor = apartment.floor;
      block = floor.block;
    } else if (dto.floorId) {
      floor = await this.floors.findOne({
        where: { id: dto.floorId },
        relations: { block: true },
      });
      if (!floor || floor.block.branchId !== branch.id) {
        throw new NotFoundException('Floor not found');
      }
      block = floor.block;
    } else if (dto.blockId) {
      block = await this.blocks.findOne({
        where: { id: dto.blockId, branchId: branch.id },
      });
      if (!block) {
        throw new NotFoundException('Block not found');
      }
    }

    if (dto.event === 'block_selected' && !block) {
      throw new BadRequestException('blockId is required');
    }
    if (dto.event === 'floor_selected' && !floor) {
      throw new BadRequestException('floorId is required');
    }
    if (
      (dto.event === 'apartment_opened' ||
        dto.event === 'apartment_sale_status') &&
      !apartment
    ) {
      throw new BadRequestException('apartmentId is required');
    }

    const blockNumber = this.formatBlockNumber(block);
    const floorLabel = floor ? `${floor.level}-etaj` : null;
    const apartmentNumber = apartment?.number ?? null;
    const apartmentLabel = apartmentNumber
      ? `${apartmentNumber}-xonadon`
      : null;
    const fullAddress = [blockNumber ? `${blockNumber}-block` : null, floorLabel, apartmentLabel]
      .filter(Boolean)
      .join('/');

    return {
      event: dto.event,
      timestamp: new Date().toISOString(),
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
      },
      address: {
        full: fullAddress,
        block: blockNumber,
        floor: floor?.level ?? null,
        apartment: apartmentNumber,
      },
      block: block
        ? {
            id: block.id,
            code: block.code,
            name: block.name,
            number: blockNumber,
          }
        : null,
      floor: floor
        ? {
            id: floor.id,
            level: floor.level,
            name: floor.name,
          }
        : null,
      apartment: apartment
        ? {
            id: apartment.id,
            number: apartment.number,
            status: dto.status ?? apartment.status,
            rooms: apartment.rooms,
            type: apartment.rooms ? `${apartment.rooms} xonali` : null,
            areaSqm: apartment.areaSqm,
          }
        : null,
    };
  }

  private formatBlockNumber(block: Block | null) {
    if (!block) return null;
    const fromName = block.name.match(/\d+/)?.[0];
    if (fromName) return fromName;
    const letter = block.code.trim().toUpperCase();
    const alphabetIndex = letter.length === 1 ? letter.charCodeAt(0) - 64 : 0;
    return alphabetIndex > 0 && alphabetIndex < 27
      ? String(alphabetIndex)
      : block.code;
  }
}
