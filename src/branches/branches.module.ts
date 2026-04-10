import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { Apartment } from '../entities/apartment.entity';
import { Branch } from '../entities/branch.entity';
import { Contract } from '../entities/contract.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, Organization, User, Contract, Apartment]),
    CommonModule,
  ],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
