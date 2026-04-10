import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendMqttDto {
  @ApiProperty({ example: 'building/A/status' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  topic: string;

  @ApiProperty({ example: '{"apartmentId":"uuid","status":"sold"}' })
  @IsString()
  @MaxLength(65_536)
  data: string;
}
