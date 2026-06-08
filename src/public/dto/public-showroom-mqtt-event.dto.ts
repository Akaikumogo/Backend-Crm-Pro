import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ApartmentStatus } from '../../apartment-status.enum';

export const SHOWROOM_MQTT_EVENTS = [
  'block_selected',
  'floor_selected',
  'apartment_opened',
  'apartment_sale_status',
] as const;

export type ShowroomMqttEvent = (typeof SHOWROOM_MQTT_EVENTS)[number];

export class PublicShowroomMqttEventDto {
  @ApiProperty({ enum: SHOWROOM_MQTT_EVENTS })
  @IsIn(SHOWROOM_MQTT_EVENTS)
  event: ShowroomMqttEvent;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  blockId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  floorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  apartmentId?: string;

  @ApiPropertyOptional({ enum: ApartmentStatus })
  @IsOptional()
  @IsIn([ApartmentStatus.SOLD, ApartmentStatus.FOR_SALE])
  status?: ApartmentStatus.SOLD | ApartmentStatus.FOR_SALE;
}
