import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncryptionService } from './encryption.service';
import { AppLogger } from './logger/app-logger.service';
import { HealthController } from './health/health.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [HealthController],
  providers: [EncryptionService, AppLogger],
  exports: [EncryptionService, AppLogger],
})
export class CommonModule {}
