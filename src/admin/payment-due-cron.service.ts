import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import {
  SuperadminNotification,
  SuperadminNotificationType,
} from '../entities/superadmin-notification.entity';

@Injectable()
export class PaymentDueCronService {
  private readonly logger = new Logger(PaymentDueCronService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgs: Repository<Organization>,
    @InjectRepository(SuperadminNotification)
    private readonly notifications: Repository<SuperadminNotification>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async notifyOverduePayments() {
    const today = new Date().toISOString().slice(0, 10);
    const orgs = await this.orgs.find({
      where: { paymentDueAt: Not(IsNull()) },
    });
    for (const org of orgs) {
      if (!org.paymentDueAt) {
        continue;
      }
      if (org.paymentDueAt > today) {
        continue;
      }
      if (org.lastNotifiedPaymentDueAt === org.paymentDueAt) {
        continue;
      }
      await this.notifications.save(
        this.notifications.create({
          type: SuperadminNotificationType.PAYMENT_DUE,
          organizationId: org.id,
          message: `“${org.name}” tashkilotining to‘lov muddati (${org.paymentDueAt}) yetgan yoki o‘tib ketgan.`,
          readAt: null,
        }),
      );
      await this.orgs.update(org.id, {
        lastNotifiedPaymentDueAt: org.paymentDueAt,
      });
      this.logger.log(`Payment due notification for org ${org.id}`);
    }
  }
}
