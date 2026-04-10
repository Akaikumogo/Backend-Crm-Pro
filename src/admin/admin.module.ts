import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../entities/organization.entity';
import { OrganizationPayment } from '../entities/organization-payment.entity';
import { SuperadminNotification } from '../entities/superadmin-notification.entity';
import { AdminBackupsController } from './admin-backups.controller';
import { AdminBackupsService } from './admin-backups.service';
import { AdminController } from './admin.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminPaymentsService } from './admin-payments.service';
import { PaymentDueCronService } from './payment-due-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationPayment,
      SuperadminNotification,
    ]),
  ],
  controllers: [AdminController, AdminBackupsController],
  providers: [
    AdminPaymentsService,
    AdminNotificationsService,
    PaymentDueCronService,
    AdminBackupsService,
  ],
  exports: [AdminPaymentsService, AdminNotificationsService],
})
export class AdminModule {}
