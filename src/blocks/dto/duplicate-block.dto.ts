import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class DuplicateBlockDto {
  @ApiProperty({ example: 'Yangi blok nomi' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    example: 'A-copy',
    description: 'Omitted: auto from source code + -copy, -copy2, ...',
  })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Matches(/^\S+$/, { message: 'code must not contain spaces' })
  code?: string;
}
