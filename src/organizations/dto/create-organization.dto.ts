import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ description: 'Organization admin login email' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  adminFullName?: string;
}
