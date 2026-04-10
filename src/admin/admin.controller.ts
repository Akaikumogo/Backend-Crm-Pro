import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UserRole } from '../user-role.enum';
import { OrganizationPayment } from '../entities/organization-payment.entity';
import { SuperadminNotification } from '../entities/superadmin-notification.entity';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminPaymentsService } from './admin-payments.service';
import { CreateOrganizationPaymentDto } from './dto/create-organization-payment.dto';

@ApiTags('admin')
@ApiBearerAuth('jwt')
@Controller('admin')
@Roles(UserRole.SUPERADMIN)
export class AdminController {
  constructor(
    private readonly payments: AdminPaymentsService,
    private readonly notifications: AdminNotificationsService,
  ) {}

  @Get('payments')
  @ApiOperation({ summary: 'List organization payment records (kassa)' })
  @ApiOkResponse({ type: [OrganizationPayment] })
  listPayments(@Query('organizationId') organizationId?: string) {
    return this.payments.findAll(organizationId);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Add payment record' })
  @ApiOkResponse({ type: OrganizationPayment })
  createPayment(
    @Body() dto: CreateOrganizationPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.create(dto, user);
  }

  @Delete('payments/:id')
  @ApiOperation({ summary: 'Delete payment record' })
  async deletePayment(@Param('id', ParseUUIDPipe) id: string) {
    const r = await this.payments.remove(id);
    if (!r.deleted) {
      throw new NotFoundException();
    }
    return r;
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Superadmin notifications' })
  @ApiOkResponse({ type: [SuperadminNotification] })
  listNotifications() {
    return this.notifications.findAll();
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(id);
  }
}
