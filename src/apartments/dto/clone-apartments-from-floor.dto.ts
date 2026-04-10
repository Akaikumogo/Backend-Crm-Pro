import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export enum CloneApartmentNumberMode {
  SAME = 'same',
  LEVEL_SHIFT = 'level_shift',
}

export class CloneApartmentsFromFloorDto {
  @ApiProperty()
  @IsUUID()
  sourceFloorId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  targetFloorIds!: string[];

  @ApiProperty({ enum: CloneApartmentNumberMode })
  @IsEnum(CloneApartmentNumberMode)
  numberMode!: CloneApartmentNumberMode;

  @ApiPropertyOptional({
    description:
      'LEVEL_SHIFT: raqam butun son bo‘lsa, (target.level - source.level) * shiftStep qo‘shiladi (masalan 101→201, step=100)',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  shiftStep?: number;

  @ApiPropertyOptional({
    description:
      'true bo‘lsa, har bir target qavatning planImageUrl manbasi qavatnikiga yoziladi (hotspots ko‘chirilmaydi — kvartira IDlari mos kelmasligi mumkin)',
  })
  @IsOptional()
  @IsBoolean()
  copyPlanFromSource?: boolean;
}
