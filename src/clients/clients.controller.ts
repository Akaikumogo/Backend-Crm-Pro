import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UserRole } from '../user-role.enum';
import { BulkDeleteClientsDto } from './dto/bulk-delete-clients.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { ClientsService } from './clients.service';

@ApiTags('clients')
@ApiBearerAuth('jwt')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post('org/:organizationId')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('clients.write')
  @ApiOperation({ summary: 'Create client in organization' })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateClientDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clients.create(dto, organizationId, user);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('clients.read')
  @ApiOperation({ summary: 'List clients (paginated)' })
  @ApiOkResponse()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('organizationId') organizationId?: string,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ) {
    return this.clients.findAll(
      user,
      organizationId,
      skip ?? 0,
      Math.min(take ?? 50, 200),
    );
  }

  @Post('bulk-delete')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('clients.delete')
  @ApiOperation({ summary: 'Bulk delete clients' })
  bulkDelete(
    @Body() dto: BulkDeleteClientsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clients.bulkRemove(dto, user);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('clients.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clients.findOne(id, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('clients.delete')
  @ApiOperation({ summary: 'Delete single client' })
  removeOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clients.removeOne(id, user);
  }
}
