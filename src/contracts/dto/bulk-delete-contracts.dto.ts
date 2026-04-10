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

export class BulkDeleteContractsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  deleteAllInScope?: boolean;

  @ValidateIf((o: BulkDeleteContractsDto) => !o.deleteAllInScope)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids?: string[];

  @ApiPropertyOptional({ description: 'Superadmin: limit delete-all to org' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
