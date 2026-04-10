import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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

@Injectable()
export class PublicService {
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

  async publishBlockTrigger(
    dto: PublicBlockTriggerDto,
    showroomToken?: string,
  ) {
    await this.access.ensurePublicBranch(dto.branchId);
    this.assertShowroomToken(showroomToken);
    const br = await this.branches.findOne({ where: { id: dto.branchId } });
    const topic = br?.mqttTopic || process.env.MQTT_TOPIC;
    if (!topic) {
      throw new BadRequestException('Branch has no mqttTopic configured');
    }
    await this.branchMqtt.publish(
      dto.branchId,
      topic,
      String(dto.blockIndex + 1),
    );
    return { ok: true };
  }
}
