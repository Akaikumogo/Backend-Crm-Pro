import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PublicBlockTriggerDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: '0-based index from showroom' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  blockIndex: number;
}
