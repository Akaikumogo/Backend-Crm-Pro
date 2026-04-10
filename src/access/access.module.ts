import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../entities/branch.entity';
import { Block } from '../entities/block.entity';
import { AccessService } from './access.service';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Block])],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
