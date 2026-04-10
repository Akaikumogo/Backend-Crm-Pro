import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BulkAssignBlocksBranchDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetBranchId: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids: string[];
}

