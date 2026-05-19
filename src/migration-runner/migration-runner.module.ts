import { Module } from '@nestjs/common';
import { MigrationRunnerService } from './migration-runner.service';

@Module({
  providers: [MigrationRunnerService],
  exports: [MigrationRunnerService],
})
export class MigrationRunnerModule {}
