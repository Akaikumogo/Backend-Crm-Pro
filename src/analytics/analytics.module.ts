import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Apartment } from '../entities/apartment.entity';
import { Block } from '../entities/block.entity';
import { Branch } from '../entities/branch.entity';
import { Floor } from '../entities/floor.entity';
import { Organization } from '../entities/organization.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, Apartment, Block, Floor, Organization]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
