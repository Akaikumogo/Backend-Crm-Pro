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

export class BulkDeleteFloorsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  deleteAllInScope?: boolean;

  @ValidateIf((o: BulkDeleteFloorsDto) => !o.deleteAllInScope)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ description: 'Limit delete-all to one block' })
  @IsOptional()
  @IsUUID()
  blockId?: string;
}
