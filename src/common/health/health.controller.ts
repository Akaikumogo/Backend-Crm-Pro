import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';

interface ComponentStatus {
  status: 'up' | 'down';
  details?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  uptimeSec: number;
  timestamp: string;
  version: string;
  components: {
    database: ComponentStatus;
  };
}

@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get('health')
  async health(): Promise<HealthResponse> {
    return this.buildReport(false);
  }

  @Get('health/ready')
  async ready(): Promise<HealthResponse> {
    return this.buildReport(true);
  }

  @Get('health/live')
  live() {
    return { status: 'ok' as const, timestamp: new Date().toISOString() };
  }

  private async buildReport(deep: boolean): Promise<HealthResponse> {
    const components = {
      database: await this.checkDatabase(deep),
    };
    const anyDown = Object.values(components).some((c) => c.status === 'down');
    return {
      status: anyDown ? 'down' : 'ok',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.0.0',
      components,
    };
  }

  private async checkDatabase(deep: boolean): Promise<ComponentStatus> {
    try {
      if (!this.dataSource.isInitialized) {
        return { status: 'down', details: 'datasource not initialized' };
      }
      if (deep) {
        await this.dataSource.query('SELECT 1');
      }
      return { status: 'up' };
    } catch (e) {
      return {
        status: 'down',
        details: e instanceof Error ? e.message : 'unknown error',
      };
    }
  }
}
