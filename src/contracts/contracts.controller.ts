import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UserRole } from '../user-role.enum';
import { BulkDeleteContractsDto } from './dto/bulk-delete-contracts.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { ContractsService } from './contracts.service';

@ApiTags('contracts')
@ApiBearerAuth('jwt')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('contracts.write')
  @ApiOperation({ summary: 'Create contract' })
  create(@Body() dto: CreateContractDto, @CurrentUser() user: JwtPayload) {
    return this.contracts.create(dto, user);
  }

  @Post('bulk-delete')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('contracts.delete')
  @ApiOperation({ summary: 'Bulk delete contracts' })
  bulkDelete(
    @Body() dto: BulkDeleteContractsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contracts.bulkRemove(dto, user);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('contracts.read')
  @ApiOperation({ summary: 'List contracts (paginated)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ) {
    return this.contracts.findAll(user, skip ?? 0, take ?? 50);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('contracts.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contracts.findOne(id, user);
  }
}
