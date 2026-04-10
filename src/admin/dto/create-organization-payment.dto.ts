import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateOrganizationPaymentDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiProperty({ example: 1500000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-04-05' })
  @IsDateString()
  paidAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
