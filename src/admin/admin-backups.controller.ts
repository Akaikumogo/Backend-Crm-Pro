import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user-role.enum';
import { AdminBackupsService } from './admin-backups.service';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { BadRequestException } from '@nestjs/common';

@ApiTags('admin')
@ApiBearerAuth('jwt')
@Controller('admin/backups')
@Roles(UserRole.SUPERADMIN)
export class AdminBackupsController {
  constructor(private readonly backups: AdminBackupsService) {}

  @Get()
  @ApiOperation({ summary: 'List uploaded backups' })
  list() {
    return this.backups.list();
  }

  @Post('dump')
  @ApiOperation({ summary: 'Create SQL dump from current DB (pg_dump)' })
  @ApiOkResponse({ description: '{ filename, size }' })
  dump() {
    return this.backups.createDump();
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Download backup .sql file' })
  download(@Param('filename') filename: string) {
    return this.backups.getDownloadStream(filename);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload SQL backup (.sql)' })
  @ApiOkResponse({ description: '{ filename }' })
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file?: { originalname: string; buffer: Buffer }) {
    if (!file?.buffer) {
      throw new BadRequestException('file is required');
    }
    return this.backups.saveUpload(file.originalname, file.buffer);
  }

  @Post('restore')
  @ApiOperation({ summary: 'Restore backup (clearAndWrite default true)' })
  restore(@Body() dto: RestoreBackupDto) {
    return this.backups.restore(dto.filename, dto.clearAndWrite ?? true);
  }
}
