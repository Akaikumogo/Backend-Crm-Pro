import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { Apartment } from '../entities/apartment.entity';
import { Block } from '../entities/block.entity';
import { Contract } from '../entities/contract.entity';
import { Floor } from '../entities/floor.entity';
import { User } from '../entities/user.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { ApartmentsController } from './apartments.controller';
import { ApartmentsService } from './apartments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Apartment, Floor, Block, Contract, User]),
    AccessModule,
    RealtimeModule,
  ],
  controllers: [ApartmentsController],
  providers: [ApartmentsService],
  exports: [ApartmentsService],
})
export class ApartmentsModule {}
