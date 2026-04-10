import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PublicBlockTriggerDto } from './dto/public-block-trigger.dto';
import { PublicChangeApartmentStatusDto } from './dto/public-change-apartment-status.dto';
import { PublicService } from './public.service';

@ApiTags('public')
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('branch/:branchId/blocks')
  @ApiOperation({ summary: 'Showroom: list blocks for branch' })
  listBlocks(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.publicService.listBlocks(branchId);
  }

  @Get('branch/:branchId/blocks/:blockId')
  @ApiOperation({ summary: 'Showroom: block with floors and apartments' })
  getBlock(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.publicService.getBlock(branchId, blockId);
  }

  @Get('branch/:branchId/floors/:floorId')
  @ApiOperation({ summary: 'Showroom: floor with plan + apartments' })
  getFloor(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
  ) {
    return this.publicService.getFloor(branchId, floorId);
  }

  @Post('branch/:branchId/apartments/:apartmentId/status')
  @ApiOperation({ summary: 'Showroom: update apartment status' })
  changeApartmentStatus(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
    @Body() dto: PublicChangeApartmentStatusDto,
    @Headers('x-showroom-token') showroomToken?: string,
  ) {
    return this.publicService.changeApartmentStatus(
      branchId,
      apartmentId,
      dto,
      showroomToken,
    );
  }

  @Get('branch/:branchId/sellers')
  @ApiOperation({ summary: 'Showroom: list sellers (staff) for branch' })
  listSellers(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Headers('x-showroom-token') showroomToken?: string,
  ) {
    return this.publicService.listSellers(branchId, showroomToken);
  }

  @Post('branch/:branchId/mqtt/publish')
  @ApiOperation({ summary: 'Showroom: publish to branch MQTT broker' })
  publishMqtt(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() body: { topic: string; data: string },
    @Headers('x-showroom-token') showroomToken?: string,
  ) {
    return this.publicService.publishMqtt(
      branchId,
      body.topic,
      body.data,
      showroomToken,
    );
  }

  @Post('mqtt/block-trigger')
  @ApiOperation({
    summary: 'Showroom: publish block index to branch mqttTopic',
  })
  blockTrigger(
    @Body() dto: PublicBlockTriggerDto,
    @Headers('x-showroom-token') showroomToken?: string,
  ) {
    return this.publicService.publishBlockTrigger(dto, showroomToken);
  }
}
