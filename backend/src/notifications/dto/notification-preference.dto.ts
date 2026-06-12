import { NotificationType } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsEnum(NotificationType)
  notificationType!: NotificationType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sendToOwner?: boolean;

  @IsOptional()
  @IsBoolean()
  sendToGeneralManager?: boolean;

  @IsOptional()
  @IsBoolean()
  sendToCoManager?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  selectedUserIds?: string[];
}
