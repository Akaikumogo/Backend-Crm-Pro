import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApartmentStatus } from '../../apartment-status.enum';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class UpdateApartmentDto {
  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  number?: string;

  @ApiPropertyOptional({ enum: ApartmentStatus })
  @IsOptional()
  @IsEnum(ApartmentStatus)
  status?: ApartmentStatus;

  @ApiPropertyOptional({ example: 72.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  areaSqm?: number | null;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rooms?: number | null;

  @ApiPropertyOptional({ example: 125000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceTotal?: number | null;

  @ApiPropertyOptional({ example: 1800 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerSqm?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  imageUrl?: string | null;
}
