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
import { RequireAnyPermission } from '../auth/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Branch } from '../entities/branch.entity';
import { UserRole } from '../user-role.enum';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('branches')
@ApiBearerAuth('jwt')
@Controller()
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Post('organizations/:organizationId/branches')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('branches.write')
  @ApiOperation({ summary: 'Create branch under organization' })
  @ApiCreatedResponse({ type: Branch })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.branches.create(organizationId, dto, user);
  }

  @Get('organizations/:organizationId/branches')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('branches.read')
  @ApiOperation({ summary: 'List branches' })
  @ApiOkResponse({ type: [Branch] })
  findByOrg(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.branches.findByOrganization(organizationId, user);
  }

  @Delete('branches/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('branches.delete')
  @ApiOperation({
    summary:
      'Delete branch (removes blocks/floors/apartments; contracts first)',
  })
  removeBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.branches.remove(id, user);
  }

  @Get('branches/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequireAnyPermission('branches.read', 'blocks.read')
  @ApiOperation({ summary: 'Get branch (no MQTT password)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.branches.findOne(id, user);
  }

  @Patch('branches/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @RequirePermissions('branches.write')
  @ApiOperation({ summary: 'Update branch / MQTT settings' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.branches.update(id, dto, user);
  }
}
