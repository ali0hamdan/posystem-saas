import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(clientId: string) {
    return this.prisma.storeSettings.upsert({
      where: { clientId },
      create: {
        clientId,
        storeName: 'Nezhin POS',
        taxEnabled: false,
        taxRate: new Prisma.Decimal(0),
        currency: 'USD',
        lowStockDefault: 5,
      },
      update: {},
    });
  }

  async update(clientId: string, actorUserId: string, dto: UpdateStoreSettingsDto) {
    const existing = await this.get(clientId);

    const data: Prisma.StoreSettingsUpdateInput = {};
    if (dto.storeName !== undefined) data.storeName = dto.storeName.trim();
    if (dto.storePhone !== undefined) data.storePhone = dto.storePhone;
    if (dto.storeAddress !== undefined) data.storeAddress = dto.storeAddress;
    if (dto.receiptFooter !== undefined) data.receiptFooter = dto.receiptFooter;
    if (dto.taxEnabled !== undefined) data.taxEnabled = dto.taxEnabled;
    if (dto.taxRate !== undefined) data.taxRate = new Prisma.Decimal(dto.taxRate);
    if (dto.currency !== undefined) data.currency = dto.currency.trim().toUpperCase();
    if (dto.lowStockDefault !== undefined) data.lowStockDefault = dto.lowStockDefault;
    if (dto.receiptLogo !== undefined) data.receiptLogo = dto.receiptLogo;
    if (dto.receiptPaperSize !== undefined) data.receiptPaperSize = dto.receiptPaperSize;
    if (dto.receiptAutoPrint !== undefined) data.receiptAutoPrint = dto.receiptAutoPrint;
    if (dto.receiptCopies !== undefined) data.receiptCopies = dto.receiptCopies;
    if (dto.receiptShowLogo !== undefined) data.receiptShowLogo = dto.receiptShowLogo;
    if (dto.receiptPrinterName !== undefined) data.receiptPrinterName = dto.receiptPrinterName;

    if (Object.keys(data).length === 0) {
      return existing;
    }

    const updated = await this.prisma.storeSettings.update({
      where: { clientId },
      data,
    });

    await this.audit.log({
      userId: actorUserId,
      clientId,
      action: 'settings.update',
      entity: 'StoreSettings',
      entityId: clientId,
      oldValue: {
        storeName: existing.storeName,
        storePhone: existing.storePhone,
        storeAddress: existing.storeAddress,
        receiptFooter: existing.receiptFooter,
        taxEnabled: existing.taxEnabled,
        taxRate: existing.taxRate.toString(),
        currency: existing.currency,
        lowStockDefault: existing.lowStockDefault,
        receiptLogo: existing.receiptLogo,
        receiptPaperSize: existing.receiptPaperSize,
        receiptAutoPrint: existing.receiptAutoPrint,
        receiptCopies: existing.receiptCopies,
        receiptShowLogo: existing.receiptShowLogo,
        receiptPrinterName: existing.receiptPrinterName,
      },
      newValue: {
        storeName: updated.storeName,
        storePhone: updated.storePhone,
        storeAddress: updated.storeAddress,
        receiptFooter: updated.receiptFooter,
        taxEnabled: updated.taxEnabled,
        taxRate: updated.taxRate.toString(),
        currency: updated.currency,
        lowStockDefault: updated.lowStockDefault,
        receiptLogo: updated.receiptLogo,
        receiptPaperSize: updated.receiptPaperSize,
        receiptAutoPrint: updated.receiptAutoPrint,
        receiptCopies: updated.receiptCopies,
        receiptShowLogo: updated.receiptShowLogo,
        receiptPrinterName: updated.receiptPrinterName,
      },
    });

    return updated;
  }
}
