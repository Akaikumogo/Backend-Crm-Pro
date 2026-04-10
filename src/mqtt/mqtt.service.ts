import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('MQTT_URL');
    if (!url) {
      this.logger.warn(
        'MQTT_URL is not set; publish calls will fail until configured',
      );
      return;
    }
    const username = this.config.get<string>('MQTT_USERNAME');
    const password = this.config.get<string>('MQTT_PASSWORD');
    this.client = mqtt.connect(url, {
      ...(username && { username }),
      ...(password && { password }),
    });
    this.client.on('connect', () => this.logger.log('MQTT connected'));
    this.client.on('error', (err) => this.logger.error(err?.message ?? err));
    this.client.on('close', () => this.logger.warn('MQTT connection closed'));
  }

  onModuleDestroy() {
    this.client?.end(true);
    this.client = null;
  }

  publish(topic: string, data: string): Promise<void> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'MQTT is not configured (set MQTT_URL)',
      );
    }
    return new Promise((resolve, reject) => {
      this.client!.publish(topic, data, { qos: 1 }, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}
