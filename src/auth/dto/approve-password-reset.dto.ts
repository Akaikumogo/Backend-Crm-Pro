import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ApprovePasswordResetDto {
  @ApiProperty({ description: 'Foydalanuvchi uchun yangi parol (kamida 8 belgi)' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
