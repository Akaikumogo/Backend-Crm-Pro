import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class HotspotDto {
  @ApiProperty()
  @IsUUID()
  apartmentId: string;

  @ApiProperty()
  @IsNumber()
  x: number;

  @ApiProperty()
  @IsNumber()
  y: number;

  @ApiProperty()
  @IsNumber()
  w: number;

  @ApiProperty()
  @IsNumber()
  h: number;
}

export class CreateFloorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  blockId: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  level: number;

  @ApiPropertyOptional({ example: '3-etaj' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  planImageUrl?: string;

  @ApiPropertyOptional({ type: [HotspotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotspotDto)
  hotspots?: HotspotDto[];
}
