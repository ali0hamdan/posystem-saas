import { ClientStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class PatchSaasClientStatusDto {
  @IsEnum(ClientStatus)
  status!: ClientStatus;
}
