import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { Block } from '../entities/block.entity';
import { Floor } from '../entities/floor.entity';
import { FloorsController } from './floors.controller';
import { FloorsService } from './floors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Floor, Block]), AccessModule],
  controllers: [FloorsController],
  providers: [FloorsService],
  exports: [FloorsService],
})
export class FloorsModule {}
