import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessService } from '../access/access.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user-role.enum';
import { BranchMqttService } from './branch-mqtt.service';
import { PublishMqttDto } from './dto/publish-mqtt.dto';

@ApiTags('integrations')
@ApiBearerAuth('jwt')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly branchMqtt: BranchMqttService,
    private readonly access: AccessService,
  ) {}

  @Post('mqtt/publish')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('integrations.mqtt')
  @ApiOperation({
    summary: 'Publish to branch MQTT broker (credentials from branch)',
  })
  @ApiOkResponse({ description: 'Published' })
  @ApiServiceUnavailableResponse()
  async publishMqtt(
    @Body() dto: PublishMqttDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const branchId =
      dto.branchId ??
      (user.role === UserRole.STAFF ? user.branchId : undefined);
    if (!branchId) {
      throw new BadRequestException('branchId is required');
    }
    await this.access.assertBranchWrite(user, branchId);
    await this.branchMqtt.publish(branchId, dto.topic, dto.data);
    return { ok: true, branchId, topic: dto.topic };
  }
}
