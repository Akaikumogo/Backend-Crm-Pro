import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Organization } from '../entities/organization.entity';
import { UserRole } from '../user-role.enum';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth('jwt')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Create organization (superadmin)' })
  @ApiCreatedResponse({ type: Organization })
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgs.create(dto);
  }

  @Get()
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'List organizations' })
  @ApiOkResponse({ type: [Organization] })
  findAll(@Query('blockedOnly') blockedOnly?: string) {
    return this.orgs.findAll(blockedOnly === 'true' || blockedOnly === '1');
  }

  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Get organization with branches' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orgs.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update organization (block, VIP, billing)' })
  @ApiOkResponse({ type: Organization })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgs.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Delete organization and all org-scoped data (irreversible)',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgs.remove(id);
  }
}
