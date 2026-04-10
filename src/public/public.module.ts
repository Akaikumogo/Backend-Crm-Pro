import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { Apartment } from '../entities/apartment.entity';
import { Block } from '../entities/block.entity';
import { Branch } from '../entities/branch.entity';
import { Floor } from '../entities/floor.entity';
import { User } from '../entities/user.entity';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Block, Floor, Apartment, User, Branch]),
    AccessModule,
    RealtimeModule,
    IntegrationsModule,
  ],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
