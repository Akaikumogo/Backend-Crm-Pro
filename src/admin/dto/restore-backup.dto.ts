import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class RestoreBackupDto {
  @ApiProperty()
  @IsString()
  @Length(1, 512)
  filename: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  clearAndWrite?: boolean;
}
