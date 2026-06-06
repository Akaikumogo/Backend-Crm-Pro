import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ApartmentStatus } from '../../apartment-status.enum';

export class PublicSetApartmentSaleStatusDto {
  @ApiProperty({
    enum: [ApartmentStatus.SOLD, ApartmentStatus.FOR_SALE],
    example: ApartmentStatus.SOLD,
  })
  @IsIn([ApartmentStatus.SOLD, ApartmentStatus.FOR_SALE])
  status: ApartmentStatus.SOLD | ApartmentStatus.FOR_SALE;
}
