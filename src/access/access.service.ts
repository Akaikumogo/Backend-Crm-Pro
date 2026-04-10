import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { Block } from '../entities/block.entity';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { UserRole } from '../user-role.enum';

@Injectable()
export class AccessService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    @InjectRepository(Block)
    private readonly blocks: Repository<Block>,
  ) {}

  async ensurePublicBranch(branchId: string): Promise<void> {
    const b = await this.branches.findOne({
      where: { id: branchId },
      relations: { organization: true },
    });
    if (!b) {
      throw new NotFoundException('Branch not found');
    }
    if (b.organization?.isBlocked) {
      const supportPhone = this.config.get<string>('SUPPORT_PHONE', '').trim();
      throw new HttpException(
        {
          code: 'ORG_BLOCKED',
          message:
            'Saytdan foydalanish huquqingiz tugatilgan. Qo‘llab-quvvatlash bilan bog‘laning.',
          supportPhone: supportPhone || undefined,
        },
        HttpStatus.FORBIDDEN,
      );
    }
    if (b.isBlocked) {
      const supportPhone = this.config.get<string>('SUPPORT_PHONE', '').trim();
      throw new HttpException(
        {
          code: 'BRANCH_BLOCKED',
          message:
            'Saytdan foydalanish huquqingiz tugatilgan. Qo‘llab-quvvatlash bilan bog‘laning.',
          supportPhone: supportPhone || undefined,
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async assertBranchRead(user: JwtPayload, branchId: string): Promise<void> {
    await this.assertBranch(user, branchId, false);
  }

  async assertBranchWrite(user: JwtPayload, branchId: string): Promise<void> {
    await this.assertBranch(user, branchId, true);
  }

  private async assertBranch(
    user: JwtPayload,
    branchId: string,
    write: boolean,
  ): Promise<void> {
    if (user.role === UserRole.SUPERADMIN) {
      const ok = await this.branches.exist({ where: { id: branchId } });
      if (!ok) throw new NotFoundException('Branch not found');
      return;
    }
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (user.role === UserRole.ORG_ADMIN) {
      if (user.organizationId !== branch.organizationId) {
        throw new ForbiddenException();
      }
      return;
    }
    if (user.role === UserRole.STAFF) {
      if (user.branchId !== branchId) {
        throw new ForbiddenException();
      }
      if (write) {
        return;
      }
      return;
    }
    throw new ForbiddenException();
  }

  async listAccessibleBranchIds(user: JwtPayload): Promise<string[]> {
    if (user.role === UserRole.SUPERADMIN) {
      const all = await this.branches.find({ select: { id: true } });
      return all.map((b) => b.id);
    }
    if (user.role === UserRole.ORG_ADMIN && user.organizationId) {
      const rows = await this.branches.find({
        where: { organizationId: user.organizationId },
        select: { id: true },
      });
      return rows.map((b) => b.id);
    }
    if (user.role === UserRole.STAFF && user.branchId) {
      return [user.branchId];
    }
    return [];
  }

  async assertBlockInAccessibleBranch(
    user: JwtPayload,
    blockId: string,
  ): Promise<Block> {
    const block = await this.blocks.findOne({
      where: { id: blockId },
      relations: { branch: true },
    });
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    await this.assertBranchRead(user, block.branchId);
    return block;
  }

  async filterBlockIdsForUser(
    user: JwtPayload,
    branchIds: string[],
  ): Promise<string[]> {
    if (!branchIds.length) {
      return [];
    }
    const rows = await this.blocks.find({
      where: { branchId: In(branchIds) },
      select: { id: true },
    });
    return rows.map((b) => b.id);
  }
}
