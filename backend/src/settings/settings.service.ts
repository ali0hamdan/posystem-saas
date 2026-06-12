import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma, RefundApprovalMethod, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SafeUser } from '../auth/types/safe-user.type';
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

  async update(clientId: string, actor: SafeUser, dto: UpdateStoreSettingsDto) {
    const existing = await this.get(clientId);

    if (dto.refundApprovalMethod !== undefined && actor.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        message: 'Only the owner can change the refund approval method',
        code: 'REFUND_APPROVAL_METHOD_FORBIDDEN',
      });
    }

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
    if (dto.enableQuotations !== undefined) data.enableQuotations = dto.enableQuotations;
    if (dto.enableProformaInvoices !== undefined) data.enableProformaInvoices = dto.enableProformaInvoices;
    if (dto.enableStockReservation !== undefined) data.enableStockReservation = dto.enableStockReservation;
    if (dto.quotationValidityDays !== undefined) data.quotationValidityDays = dto.quotationValidityDays;
    if (dto.proformaValidityDays !== undefined) data.proformaValidityDays = dto.proformaValidityDays;
    if (dto.quotationTerms !== undefined) data.quotationTerms = dto.quotationTerms;
    if (dto.proformaTerms !== undefined) data.proformaTerms = dto.proformaTerms;
    if (dto.quotationPrefix !== undefined) data.quotationPrefix = dto.quotationPrefix.trim().toUpperCase();
    if (dto.proformaPrefix !== undefined) data.proformaPrefix = dto.proformaPrefix.trim().toUpperCase();
    if (dto.invoicePrefix !== undefined) data.invoicePrefix = dto.invoicePrefix.trim().toUpperCase();
    if (dto.showTaxOnQuotation !== undefined) data.showTaxOnQuotation = dto.showTaxOnQuotation;
    if (dto.showSignatureArea !== undefined) data.showSignatureArea = dto.showSignatureArea;
    if (dto.deliveryNotePrefix !== undefined) data.deliveryNotePrefix = dto.deliveryNotePrefix.trim().toUpperCase();
    if (dto.defaultPaymentTermsDays !== undefined) data.defaultPaymentTermsDays = dto.defaultPaymentTermsDays;
    if (dto.enableCustomerCredit !== undefined) data.enableCustomerCredit = dto.enableCustomerCredit;
    if (dto.enableDeliveryNotes !== undefined) data.enableDeliveryNotes = dto.enableDeliveryNotes;
    if (dto.enableApprovalWorkflow !== undefined) data.enableApprovalWorkflow = dto.enableApprovalWorkflow;
    if (dto.allowOverCreditOverride !== undefined) data.allowOverCreditOverride = dto.allowOverCreditOverride;
    if (dto.allowOverStockOverride !== undefined) data.allowOverStockOverride = dto.allowOverStockOverride;
    if (dto.emailNotificationsEnabled !== undefined) data.emailNotificationsEnabled = dto.emailNotificationsEnabled;
    if (dto.notifyLowStock !== undefined) data.notifyLowStock = dto.notifyLowStock;
    if (dto.notifyInvoicePayment !== undefined) data.notifyInvoicePayment = dto.notifyInvoicePayment;
    if (dto.notifyCustomerOverdue !== undefined) data.notifyCustomerOverdue = dto.notifyCustomerOverdue;
    if (dto.notifySubscription !== undefined) data.notifySubscription = dto.notifySubscription;
    if (dto.notifyDeviceActivation !== undefined) data.notifyDeviceActivation = dto.notifyDeviceActivation;
    if (dto.refundApprovalMethod !== undefined) data.refundApprovalMethod = dto.refundApprovalMethod;

    if (Object.keys(data).length === 0) {
      return existing;
    }

    const updated = await this.prisma.storeSettings.update({
      where: { clientId },
      data,
    });

    await this.audit.log({
      userId: actor.id,
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
