import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CopyApartmentsFromFloorDto {
  @ApiProperty({ description: 'Kvartiralari nusxalanadigan manba qavat' })
  @IsUUID()
  sourceFloorId!: string;

  @ApiProperty({
    type: [String],
    description:
      'Xuddi shu blokdagi qabul qiluvchi qavatlar (manba o‘zi bo‘lmasligi kerak)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  targetFloorIds!: string[];

  @ApiPropertyOptional({
    description:
      'Butun raqamli kvartira raqamlari uchun: yangiRaqam = eskiRaqam + (qavatZ - manbaZ) * multiplier. Masalan 101→201 uchun multiplier=100',
    default: 100,
    minimum: 1,
    maximum: 100000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  levelMultiplier?: number;
}
