import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateBlockDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @Length(1, 32)
  @Matches(/^\S+$/, { message: 'code must not contain spaces' })
  code: string;

  @ApiProperty({ example: 'Markaziy blok' })
  @IsString()
  @Length(1, 255)
  name: string;
}
