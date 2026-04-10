import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apartment } from '../entities/apartment.entity';
import { Client } from '../entities/client.entity';
import { Contract } from '../entities/contract.entity';
import { User } from '../entities/user.entity';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Apartment, Client, User])],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
