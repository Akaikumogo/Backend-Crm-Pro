import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateBranchDto {
  @ApiProperty()
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 32)
  code?: string;

  @ApiPropertyOptional({ description: 'MQTT broker URL' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  mqttUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mqttUsername?: string;

  @ApiPropertyOptional({ description: 'Plain password; stored encrypted' })
  @IsOptional()
  @IsString()
  mqttPassword?: string;

  @ApiPropertyOptional({ description: 'MQTT topic for showroom triggers' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  mqttTopic?: string;

  @ApiPropertyOptional({
    description:
      'Filial admini (STAFF): alohida login — ixtiyoriy; to‘ldirilsa filial uchun asosiy akkaunt yaratiladi',
  })
  @IsOptional()
  @ValidateIf((_: unknown, o: { staffEmail?: string }) => Boolean(o.staffEmail))
  @IsEmail()
  staffEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_: unknown, o: { staffEmail?: string }) => Boolean(o.staffEmail))
  @IsString()
  @MinLength(8)
  staffPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  staffFullName?: string;
}
