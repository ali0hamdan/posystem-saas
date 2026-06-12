import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { OtpPurpose } from '@prisma/client';
import {
  businessNotificationTemplate,
  invoiceNotificationTemplate,
  lowStockNotificationTemplate,
  otpVerificationTemplate,
  passwordChangedTemplate,
  passwordResetOtpTemplate,
} from './email.templates';

export class EmailDeliveryError extends Error {
  constructor(message = 'Could not send verification email. Please try again.') {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly fromName: string;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    this.fromName = this.config.get<string>('SMTP_FROM_NAME') ?? 'Nezhin POS';
    this.fromEmail = this.config.get<string>('SMTP_FROM_EMAIL') ?? 'noreply@localhost';
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS');
    const secureRaw = this.config.get<string>('SMTP_SECURE');
    const secure = secureRaw === 'true' || secureRaw === '1';

    if (!host) {
      this.logger.warn('SMTP_HOST is not configured; emails will not be sent');
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    const transport = this.getTransporter();
    if (!transport) {
      throw new EmailDeliveryError('Email service is not configured.');
    }

    try {
      await transport.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      });
      this.logger.log(`Email sent to ${to} (subject: ${subject})`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
      throw new EmailDeliveryError();
    }
  }

  async sendOtpEmail(to: string, otpCode: string, purpose: OtpPurpose): Promise<void> {
    if (purpose === OtpPurpose.PASSWORD_RESET) {
      await this.sendPasswordResetOtp(to, otpCode);
    } else {
      await this.sendEmailVerificationOtp(to, otpCode);
    }
  }

  async sendEmailVerificationOtp(to: string, otpCode: string): Promise<void> {
    const { html, text } = otpVerificationTemplate(otpCode);
    await this.sendEmail(to, `Verify your email - ${this.fromName}`, html, text);
  }

  async sendPasswordResetOtp(to: string, otpCode: string): Promise<void> {
    const { html, text } = passwordResetOtpTemplate(otpCode);
    await this.sendEmail(to, `Password reset code - ${this.fromName}`, html, text);
  }

  async sendPasswordChangedConfirmation(to: string): Promise<void> {
    const { html, text } = passwordChangedTemplate();
    try {
      await this.sendEmail(to, `Password changed - ${this.fromName}`, html, text);
    } catch {
      // Non-critical notification
      this.logger.warn(`Password changed confirmation could not be sent to ${to}`);
    }
  }

  async sendNotificationEmail(
    to: string,
    subject: string,
    message: string,
    data?: {
      businessName?: string;
      link?: string;
      extra?: Record<string, string | number | null | undefined>;
    },
  ): Promise<void> {
    const businessName = data?.businessName ?? this.fromName;
    const { html, text } = businessNotificationTemplate(
      subject,
      message,
      businessName,
      data?.link,
      data?.extra,
    );
    try {
      await this.sendEmail(to, subject, html, text);
    } catch {
      this.logger.warn(`Notification email could not be sent to ${to} (subject: ${subject})`);
    }
  }

  async sendLowStockAlert(
    to: string,
    params: {
      businessName: string;
      productName: string;
      currentStock: number;
      minStock: number;
      branchName: string;
      link?: string;
    },
  ): Promise<void> {
    const { html, text } = lowStockNotificationTemplate(params);
    try {
      await this.sendEmail(to, `Low stock alert - ${this.fromName}`, html, text);
    } catch {
      this.logger.warn(`Low stock alert could not be sent to ${to}`);
    }
  }

  async sendInvoiceAlert(
    to: string,
    params: {
      businessName: string;
      invoiceNumber: string;
      total: string;
      customerName?: string;
      link?: string;
    },
  ): Promise<void> {
    const { html, text } = invoiceNotificationTemplate(params);
    try {
      await this.sendEmail(to, `New invoice - ${this.fromName}`, html, text);
    } catch {
      this.logger.warn(`Invoice notification could not be sent to ${to}`);
    }
  }
}
