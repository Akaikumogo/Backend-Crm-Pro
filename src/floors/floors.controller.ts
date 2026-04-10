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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Floor } from '../entities/floor.entity';
import { BulkDeleteFloorsDto } from './dto/bulk-delete-floors.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorsService } from './floors.service';

@ApiTags('floors')
@ApiBearerAuth('jwt')
@Controller('floors')
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Post()
  @RequirePermissions('floors.write')
  @ApiOperation({ summary: 'Create floor in a block' })
  @ApiCreatedResponse({ type: Floor })
  @ApiUnprocessableEntityResponse()
  create(@Body() dto: CreateFloorDto, @CurrentUser() user: JwtPayload) {
    return this.floorsService.create(dto, user);
  }

  @Get()
  @RequirePermissions('floors.read')
  @ApiOperation({ summary: 'List floors (optionally by blockId)' })
  @ApiOkResponse({ type: [Floor] })
  findAll(
    @Query('blockId', new ParseUUIDPipe({ optional: true }))
    blockId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (blockId) {
      return this.floorsService.findByBlock(blockId, user);
    }
    return this.floorsService.findAll(user);
  }

  @Post('bulk-delete')
  @RequirePermissions('floors.delete')
  @ApiOperation({ summary: 'Bulk delete floors (by ids or all in scope)' })
  bulkDelete(
    @Body() dto: BulkDeleteFloorsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.floorsService.bulkRemove(dto, user);
  }

  @Get(':id')
  @RequirePermissions('floors.read')
  @ApiOperation({ summary: 'Get floor with apartments' })
  @ApiOkResponse({ type: Floor })
  @ApiNotFoundResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.floorsService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions('floors.write')
  @ApiOperation({ summary: 'Update floor' })
  @ApiOkResponse({ type: Floor })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFloorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.floorsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('floors.delete')
  @ApiOperation({ summary: 'Delete floor (cascades apartments if allowed)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.floorsService.remove(id, user);
  }
}
