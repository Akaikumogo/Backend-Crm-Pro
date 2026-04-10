import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApartmentStatus } from '../../apartment-status.enum';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ChangeApartmentStatusDto {
  @ApiProperty({
    enum: ApartmentStatus,
    example: ApartmentStatus.RESERVED,
  })
  @IsEnum(ApartmentStatus)
  status: ApartmentStatus;

  @ApiPropertyOptional({
    description: 'Optional seller/employee (used when marking as SOLD)',
  })
  @IsOptional()
  @IsUUID()
  sellerId?: string;
}
