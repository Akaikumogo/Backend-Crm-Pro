import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { SeedModule } from './seed/seed.module';
import { UsersModule } from './users/users.module';
import { Branch } from './entities/branch.entity';
import { Organization } from './entities/organization.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CommonModule,
    TypeOrmModule.forFeature([Organization, Branch]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'shoxsaroy'),
        autoLoadEntities: true,
        synchronize: config.get<string>('DB_SYNC', 'true') === 'true',
      }),
      inject: [ConfigService],
    }),
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
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: OrganizationBlockedGuard },
    { provide: APP_GUARD, useClass: BranchBlockedGuard },
  ],
})
export class AppModule {}
