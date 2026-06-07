import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { AccessModule } from './access/access.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ApartmentsModule } from './apartments/apartments.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { BranchBlockedGuard } from './auth/branch-blocked.guard';
import { OrganizationBlockedGuard } from './auth/organization-blocked.guard';
import { PermissionGuard } from './auth/permission.guard';
import { RolesGuard } from './auth/roles.guard';
import { BlocksModule } from './blocks/blocks.module';
import { BranchesModule } from './branches/branches.module';
import { ClientsModule } from './clients/clients.module';
import { CommonModule } from './common/common.module';
import { ContractsModule } from './contracts/contracts.module';
import { FloorsModule } from './floors/floors.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MqttModule } from './mqtt/mqtt.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PublicModule } from './public/public.module';
import { RealtimeModule } from './realtime/realtime.module';
import { MigrationRunnerModule } from './migration-runner/migration-runner.module';
import { SeedModule } from './seed/seed.module';
import { UsersModule } from './users/users.module';
import { Branch } from './entities/branch.entity';
import { Organization } from './entities/organization.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL_SEC', 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT', 120),
        },
      ],
      inject: [ConfigService],
    }),
    CommonModule,
    TypeOrmModule.forFeature([Organization, Branch]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const sslEnabled = config.get<boolean>('DB_SSL') === true;
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT'),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_NAME'),
          autoLoadEntities: true,
          synchronize: !isProd && config.get<boolean>('DB_SYNC') === true,
          ssl: sslEnabled ? { rejectUnauthorized: false } : false,
          extra: {
            max: config.get<number>('DB_POOL_MAX', 20),
            connectionTimeoutMillis: config.get<number>(
              'DB_CONN_TIMEOUT_MS',
              10000,
            ),
            idleTimeoutMillis: 30000,
          },
          retryAttempts: isProd ? 10 : 3,
          retryDelay: 3000,
        };
      },
      inject: [ConfigService],
    }),
    MigrationRunnerModule,
    SeedModule,
    AuthModule,
    AccessModule,
    OrganizationsModule,
    AdminModule,
    AnalyticsModule,
    BranchesModule,
    UsersModule,
    ClientsModule,
    ContractsModule,
    PublicModule,
    RealtimeModule,
    IntegrationsModule,
    BlocksModule,
    FloorsModule,
    ApartmentsModule,
    MqttModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: OrganizationBlockedGuard },
    { provide: APP_GUARD, useClass: BranchBlockedGuard },
  ],
})
export class AppModule {}
