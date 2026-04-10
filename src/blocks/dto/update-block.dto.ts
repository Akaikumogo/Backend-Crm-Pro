import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateBlockDto {
  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Matches(/^\S+$/, { message: 'code must not contain spaces' })
  code?: string;

  @ApiPropertyOptional({ example: 'Markaziy blok' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;
}
