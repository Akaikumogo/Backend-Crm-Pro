import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateUserPermissionsDto {
  @ApiProperty({
    type: [String],
    example: ['blocks.read', 'blocks.write'],
    description: 'Empty array revokes all granular access for STAFF',
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
