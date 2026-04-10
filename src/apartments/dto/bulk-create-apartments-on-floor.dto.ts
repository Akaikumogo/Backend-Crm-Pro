import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class BulkCreateApartmentsOnFloorDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  floorId: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 200 })
  @IsInt()
  @Min(1)
  @Max(200)
  count: number;
}
