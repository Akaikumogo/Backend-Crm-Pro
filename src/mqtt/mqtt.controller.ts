import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SendMqttDto } from './dto/send-mqtt.dto';
import { MqttService } from './mqtt.service';

@ApiTags('mqtt')
@Public()
@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Post('sendmqtt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish string payload to the given MQTT topic' })
  @ApiOkResponse({ description: 'Published' })
  @ApiServiceUnavailableResponse({
    description: 'MQTT_URL not configured or broker error',
  })
  async sendMqtt(@Body() body: SendMqttDto) {
    await this.mqttService.publish(body.topic, body.data);
    return { ok: true, topic: body.topic };
  }
}
