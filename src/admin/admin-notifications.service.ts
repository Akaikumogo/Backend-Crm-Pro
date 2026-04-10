import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuperadminNotification } from '../entities/superadmin-notification.entity';

@Injectable()
export class AdminNotificationsService {
  constructor(
    @InjectRepository(SuperadminNotification)
    private readonly notifications: Repository<SuperadminNotification>,
  ) {}

  findAll() {
    return this.notifications.find({
      relations: { organization: true },
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }

  async markRead(id: string) {
    const n = await this.notifications.findOne({ where: { id } });
    if (!n) {
      throw new NotFoundException();
    }
    n.readAt = new Date();
    return this.notifications.save(n);
  }
}
