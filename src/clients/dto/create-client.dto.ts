import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateClientDto {
  @ApiProperty()
  @IsString()
  @Length(1, 255)
  fullName: string;

  @ApiProperty()
  @IsString()
  @Length(5, 32)
  @Matches(/^\+?[0-9\s-]+$/)
  phone: string;
}
