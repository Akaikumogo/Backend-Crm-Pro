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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { Block } from '../entities/block.entity';
import { BlocksService } from './blocks.service';
import { BulkAssignBlocksBranchDto } from './dto/bulk-assign-blocks-branch.dto';
import { BulkDeleteBlocksDto } from './dto/bulk-delete-blocks.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { DuplicateBlockDto } from './dto/duplicate-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

@ApiTags('blocks')
@ApiBearerAuth('jwt')
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post()
  @RequirePermissions('blocks.write')
  @ApiOperation({ summary: 'Create block' })
  @ApiCreatedResponse({ type: Block })
  create(@Body() dto: CreateBlockDto, @CurrentUser() user: JwtPayload) {
    return this.blocksService.create(dto, user);
  }

  @Get()
  @RequirePermissions('blocks.read')
  @ApiOperation({ summary: 'List all blocks' })
  @ApiOkResponse({ type: [Block] })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.blocksService.findAll(user);
  }

  @Post('bulk-delete')
  @RequirePermissions('blocks.delete')
  @ApiOperation({
    summary: 'Bulk delete blocks (by ids or all in accessible scope)',
  })
  bulkDelete(
    @Body() dto: BulkDeleteBlocksDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.blocksService.bulkRemove(dto, user);
  }

  @Post('bulk-assign-branch')
  @RequirePermissions('blocks.write')
  @ApiOperation({ summary: 'Bulk assign blocks to another branch' })
  bulkAssignBranch(
    @Body() dto: BulkAssignBlocksBranchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.blocksService.bulkAssignBranch(dto, user);
  }

  @Post(':id/duplicate')
  @RequirePermissions('blocks.write')
  @ApiOperation({
    summary: 'Duplicate block (floors, apartments, plans; new name/code)',
  })
  @ApiCreatedResponse({ type: Block })
  @ApiNotFoundResponse()
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateBlockDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.blocksService.duplicate(id, dto, user);
  }

  @Get(':id')
  @RequirePermissions('blocks.read')
  @ApiOperation({ summary: 'Get block with floors and apartments' })
  @ApiOkResponse({ type: Block })
  @ApiNotFoundResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.blocksService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions('blocks.write')
  @ApiOperation({ summary: 'Update block' })
  @ApiOkResponse({ type: Block })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBlockDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.blocksService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('blocks.delete')
  @ApiOperation({
    summary: 'Delete block (cascades floors/apartments if allowed)',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.blocksService.remove(id, user);
  }
}
