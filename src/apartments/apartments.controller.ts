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
import { Apartment } from '../entities/apartment.entity';
import { BulkCreateApartmentsOnFloorDto } from './dto/bulk-create-apartments-on-floor.dto';
import { BulkDeleteApartmentsDto } from './dto/bulk-delete-apartments.dto';
import { ChangeApartmentStatusDto } from './dto/change-apartment-status.dto';
import { CopyApartmentsFromFloorDto } from './dto/copy-apartments-from-floor.dto';
import { CreateApartmentDto } from './dto/create-apartment.dto';
import { UpdateApartmentDto } from './dto/update-apartment.dto';
import { ApartmentsService } from './apartments.service';

@ApiTags('apartments')
@ApiBearerAuth('jwt')
@Controller('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Post()
  @RequirePermissions('apartments.write')
  @ApiOperation({ summary: 'Create apartment on a floor' })
  @ApiCreatedResponse({ type: Apartment })
  @ApiUnprocessableEntityResponse()
  create(@Body() dto: CreateApartmentDto, @CurrentUser() user: JwtPayload) {
    return this.apartmentsService.create(dto, user);
  }

  @Get()
  @RequirePermissions('apartments.read')
  @ApiOperation({ summary: 'List apartments (optionally by floorId)' })
  @ApiOkResponse({ type: [Apartment] })
  findAll(
    @Query('floorId', new ParseUUIDPipe({ optional: true }))
    floorId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (floorId) {
      return this.apartmentsService.findByFloor(floorId, user);
    }
    return this.apartmentsService.findAll(user);
  }

  @Post('bulk-delete')
  @RequirePermissions('apartments.delete')
  @ApiOperation({
    summary: 'Bulk delete apartments (skips units with contracts)',
  })
  bulkDelete(
    @Body() dto: BulkDeleteApartmentsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apartmentsService.bulkRemove(dto, user);
  }

  @Post('copy-from-floor')
  @RequirePermissions('apartments.write')
  @ApiOperation({
    summary:
      'Manba qavatdagi kvartiralarni boshqa qavatlarga nusxalash (bir blokda, raqam + (etaj farqi)×multiplier)',
  })
  @ApiOkResponse({
    description: 'created / skippedConflict / skippedNonNumeric',
  })
  copyFromFloor(
    @Body() dto: CopyApartmentsFromFloorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apartmentsService.copyFromFloor(dto, user);
  }

  @Post('bulk-create-on-floor')
  @RequirePermissions('apartments.write')
  @ApiOperation({
    summary:
      'Bir qavatga avtomatik raqamlangan N ta kvartira (mavjud max raqamdan keyin)',
  })
  @ApiOkResponse({ description: '{ created: number }' })
  bulkCreateOnFloor(
    @Body() dto: BulkCreateApartmentsOnFloorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apartmentsService.bulkCreateOnFloor(dto, user);
  }

  @Get(':id')
  @RequirePermissions('apartments.read')
  @ApiOperation({ summary: 'Get apartment' })
  @ApiOkResponse({ type: Apartment })
  @ApiNotFoundResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apartmentsService.findOne(id, user);
  }

  @Post(':id/status')
  @RequirePermissions('apartments.write')
  @ApiOperation({ summary: 'Update apartment status (single POST)' })
  @ApiOkResponse({ type: Apartment })
  @ApiNotFoundResponse()
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeApartmentStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apartmentsService.changeStatus(id, dto, user);
  }

  @Patch(':id')
  @RequirePermissions('apartments.write')
  @ApiOperation({ summary: 'Update apartment' })
  @ApiOkResponse({ type: Apartment })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApartmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apartmentsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('apartments.delete')
  @ApiOperation({ summary: 'Delete apartment (blocked if contracts exist)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apartmentsService.remove(id, user);
  }
}
