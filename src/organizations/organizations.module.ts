import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../entities/client.entity';
import { Contract } from '../entities/contract.entity';
import { OrganizationPayment } from '../entities/organization-payment.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      User,
      Contract,
      Client,
      OrganizationPayment,
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
