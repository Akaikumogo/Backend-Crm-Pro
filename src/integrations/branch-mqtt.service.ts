import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';
import { Repository } from 'typeorm';
import { EncryptionService } from '../common/encryption.service';
import { Branch } from '../entities/branch.entity';

const IDLE_MS = 5 * 60 * 1000;

type Cached = { client: MqttClient; lastUsed: number; timer: NodeJS.Timeout };

@Injectable()
export class BranchMqttService implements OnModuleDestroy {
  private readonly logger = new Logger(BranchMqttService.name);
  private readonly cache = new Map<string, Cached>();

  constructor(
    @InjectRepository(Branch)
    private readonly branches: Repository<Branch>,
    private readonly encryption: EncryptionService,
  ) {}

  onModuleDestroy() {
    for (const c of this.cache.values()) {
      clearTimeout(c.timer);
      c.client.end(true);
    }
    this.cache.clear();
  }

  async publish(branchId: string, topic: string, data: string): Promise<void> {
    const branch = await this.branches.findOne({ where: { id: branchId } });
    if (!branch?.mqttUrl) {
      throw new ServiceUnavailableException(
        'Branch has no MQTT URL configured',
      );
    }
    const client = await this.getOrCreateClient(branch);
    await new Promise<void>((resolve, reject) => {
      client.publish(topic, data, { qos: 1 }, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    this.scheduleIdleClose(branch.id);
  }

  private async getOrCreateClient(branch: Branch): Promise<MqttClient> {
    const existing = this.cache.get(branch.id);
    if (existing) {
      existing.lastUsed = Date.now();
      this.scheduleIdleClose(branch.id);
      return existing.client;
    }
    let password: string | undefined;
    if (branch.mqttPasswordEncrypted) {
      try {
        password = this.encryption.decrypt(branch.mqttPasswordEncrypted);
      } catch {
        this.logger.error(
          `Decrypt MQTT password failed for branch ${branch.id}`,
        );
        throw new ServiceUnavailableException('MQTT credentials invalid');
      }
    }
    const client = mqtt.connect(branch.mqttUrl!, {
      username: branch.mqttUsername || undefined,
      password,
    });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error('MQTT connect timeout')),
        15000,
      );
      client.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });
    const timer = setTimeout(() => this.closeIdle(branch.id), IDLE_MS);
    this.cache.set(branch.id, {
      client,
      lastUsed: Date.now(),
      timer,
    });
    return client;
  }

  private scheduleIdleClose(branchId: string) {
    const entry = this.cache.get(branchId);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => this.closeIdle(branchId), IDLE_MS);
  }

  private closeIdle(branchId: string) {
    const entry = this.cache.get(branchId);
    if (!entry) {
      return;
    }
    if (Date.now() - entry.lastUsed < IDLE_MS - 1000) {
      this.scheduleIdleClose(branchId);
      return;
    }
    clearTimeout(entry.timer);
    entry.client.end(true);
    this.cache.delete(branchId);
    this.logger.debug(`Closed idle MQTT client for branch ${branchId}`);
  }
}
