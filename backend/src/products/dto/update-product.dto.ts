import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './product.dto';

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['quantity'] as const),
) {}
