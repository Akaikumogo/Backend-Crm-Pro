import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  blockedReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD; omit or null to clear' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value === undefined ? null : value,
  )
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  paymentDueAt?: string | null;
}
