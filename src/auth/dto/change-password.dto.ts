import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Joriy parol' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ description: 'Yangi parol (kamida 8 belgi)' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
