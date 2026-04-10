import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class BulkDeleteUsersDto {
  @ApiPropertyOptional({
    description:
      'true: delete all users visible to actor in list scope (no superadmin)',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  deleteAllInScope?: boolean;

  @ValidateIf((o: BulkDeleteUsersDto) => !o.deleteAllInScope)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids?: string[];
}
