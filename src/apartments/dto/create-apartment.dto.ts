import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApartmentStatus } from '../../apartment-status.enum';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateApartmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  floorId: string;

  @ApiProperty({ example: '12' })
  @IsString()
  @Length(1, 32)
  number: string;

  @ApiPropertyOptional({
    enum: ApartmentStatus,
    default: ApartmentStatus.FOR_SALE,
  })
  @IsOptional()
  @IsEnum(ApartmentStatus)
  status?: ApartmentStatus;

  @ApiPropertyOptional({ example: 72.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  areaSqm?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rooms?: number;

  @ApiPropertyOptional({ example: 125000, description: 'Umumiy narx' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceTotal?: number;

  @ApiPropertyOptional({ example: 1800, description: 'm² narxi' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerSqm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  imageUrl?: string;
}
