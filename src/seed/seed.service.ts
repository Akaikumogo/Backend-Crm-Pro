import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.config
      .get<string>('SUPERADMIN_EMAIL', '')
      .toLowerCase()
      .trim();
    const password = this.config.get<string>('SUPERADMIN_PASSWORD', '');
    if (!email || !password) {
      this.logger.warn(
        'SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set; skip superadmin seed',
      );
      return;
    }
    const exists = await this.users.exist({ where: { email } });
    if (exists) {
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.users.save(
      this.users.create({
        email,
        passwordHash,
        role: UserRole.SUPERADMIN,
        organizationId: null,
        branchId: null,
        fullName: 'Superadmin',
      }),
    );
    this.logger.log(`Seeded superadmin user ${email}`);
  }
}
