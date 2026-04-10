import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApartmentStatus } from '../../apartment-status.enum';

export class PublicChangeApartmentStatusDto {
  @ApiProperty({ enum: ApartmentStatus, example: ApartmentStatus.RESERVED })
  @IsEnum(ApartmentStatus)
  status: ApartmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sellerId?: string;
}
