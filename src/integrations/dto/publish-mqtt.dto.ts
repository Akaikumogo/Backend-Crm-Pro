import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublishMqttDto {
  @ApiPropertyOptional({
    description: 'Defaults to JWT user branchId for STAFF',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  topic: string;

  @ApiProperty()
  @IsString()
  @MaxLength(65_536)
  data: string;
}
