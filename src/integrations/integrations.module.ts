import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { Branch } from '../entities/branch.entity';
import { BranchMqttService } from './branch-mqtt.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Branch]), AccessModule],
  controllers: [IntegrationsController],
  providers: [BranchMqttService],
  exports: [BranchMqttService],
})
export class IntegrationsModule {}
