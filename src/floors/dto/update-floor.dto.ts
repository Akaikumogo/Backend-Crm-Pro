import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { HotspotDto } from './create-floor.dto';

export class UpdateFloorDto {
  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number;

  @ApiPropertyOptional({ example: '3-etaj' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  name?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  planImageUrl?: string | null;

  @ApiPropertyOptional({ type: [HotspotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotspotDto)
  hotspots?: HotspotDto[] | null;
}
