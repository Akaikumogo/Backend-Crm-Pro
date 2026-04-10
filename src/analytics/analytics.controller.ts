import { Controller, Get } from '@nestjs/common';
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
import {
  AnalyticsService,
  BranchOverviewRow,
  SuperadminInventoryRow,
} from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth('jwt')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Roles(UserRole.SUPERADMIN, UserRole.ORG_ADMIN, UserRole.STAFF)
  @RequirePermissions('dashboard.home')
  @ApiOperation({
    summary:
      'Superadmin: barcha filiallar; org admin: tashkilot; STAFF: faqat o‘z filiali',
  })
  @ApiOkResponse({ description: 'Filial kesimida sonlar' })
  overview(@CurrentUser() user: JwtPayload): Promise<BranchOverviewRow[]> {
    return this.analytics.overview(user);
  }

  @Get('superadmin-inventory')
  @Roles(UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Tashkilot → filial → blok / qavat / kvartira sonlari',
  })
  @ApiOkResponse({ description: 'Har bir filial uchun inventar' })
  superadminInventory(): Promise<SuperadminInventoryRow[]> {
    return this.analytics.superadminInventory();
  }
}
