import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { User } from '../entities/user.entity';
import { UserRole } from '../user-role.enum';
import { BulkDeleteUsersDto } from './dto/bulk-delete-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { UpdateUserScopeDto } from './dto/update-user-scope.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('jwt')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('workers.write')
  @ApiOperation({ summary: 'Create staff / org admin' })
  @ApiCreatedResponse({ description: 'User without password hash' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.users.create(dto, user);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('workers.read')
  @ApiOperation({ summary: 'List users (scoped by role)' })
  @ApiOkResponse({ type: [User] })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.users.findAll(user);
  }

  @Post('bulk-delete')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('workers.write')
  @ApiOperation({ summary: 'Bulk delete users' })
  bulkDelete(@Body() dto: BulkDeleteUsersDto, @CurrentUser() user: JwtPayload) {
    return this.users.bulkRemove(dto, user);
  }

  @Patch(':id/permissions')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('workers.write')
  @ApiOperation({ summary: 'Replace STAFF permission list (org scoped)' })
  updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.users.updatePermissions(id, dto.permissions, user);
  }

  @Patch(':id/scope')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('workers.write')
  @ApiOperation({ summary: 'Update user scope (staff branchId)' })
  updateScope(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserScopeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.users.updateScope(id, dto, user);
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('workers.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.users.findOne(id, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('workers.write')
  @ApiOperation({ summary: 'Delete single user' })
  removeOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.users.removeMany([id], user);
  }
}
