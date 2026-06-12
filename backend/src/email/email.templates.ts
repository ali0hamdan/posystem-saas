const BRAND = 'Nezhin POS';

function layout(title: string, bodyHtml: string, bodyText: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <div style="margin-bottom:24px;">
    <strong style="font-size:18px;color:#2563eb;">${BRAND}</strong>
  </div>
  ${bodyHtml}
  <p style="margin-top:32px;font-size:12px;color:#6b7280;">&copy; ${new Date().getFullYear()} ${BRAND}. All rights reserved.</p>
</body>
</html>`;
  return { html, text: `${title}\n\n${bodyText}\n\n— ${BRAND}` };
}

export function otpVerificationTemplate(otpCode: string) {
  const bodyHtml = `
  <h1 style="font-size:20px;margin:0 0 12px;">Verify your email</h1>
  <p>Use this code to verify your email address:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0;">${otpCode}</p>
  <p style="color:#6b7280;font-size:14px;">This code expires in <strong>10 minutes</strong>.</p>
  <p style="color:#6b7280;font-size:14px;">If you did not request this, you can safely ignore this email.</p>`;
  const bodyText = `Verify your email\n\nYour verification code: ${otpCode}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.`;
  return layout('Verify your email', bodyHtml, bodyText);
}

export function passwordResetOtpTemplate(otpCode: string) {
  const bodyHtml = `
  <h1 style="font-size:20px;margin:0 0 12px;">Reset your password</h1>
  <p>Use this code to reset your password:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0;">${otpCode}</p>
  <p style="color:#6b7280;font-size:14px;">This code expires in <strong>10 minutes</strong>.</p>
  <p style="color:#6b7280;font-size:14px;">If you did not request a password reset, ignore this email.</p>`;
  const bodyText = `Reset your password\n\nYour reset code: ${otpCode}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.`;
  return layout('Reset your password', bodyHtml, bodyText);
}

export function passwordChangedTemplate() {
  const bodyHtml = `
  <h1 style="font-size:20px;margin:0 0 12px;">Password changed</h1>
  <p>Your ${BRAND} account password was changed successfully.</p>
  <p style="color:#6b7280;font-size:14px;">If you did not make this change, contact support immediately.</p>`;
  const bodyText = `Your ${BRAND} account password was changed successfully.\nIf you did not make this change, contact support immediately.`;
  return layout('Password changed', bodyHtml, bodyText);
}

export function businessNotificationTemplate(
  subject: string,
  message: string,
  businessName: string,
  link?: string,
  data?: Record<string, string | number | null | undefined>,
) {
  const rows = data
    ? Object.entries(data)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;">${k}</td><td style="padding:6px 0;"><strong>${String(v)}</strong></td></tr>`,
        )
        .join('')
    : '';
  const table = rows
    ? `<table style="margin:16px 0;font-size:14px;">${rows}</table>`
    : '';
  const button = link
    ? `<p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">View in ${BRAND}</a></p>`
    : '';
  const bodyHtml = `
  <h1 style="font-size:20px;margin:0 0 8px;">${subject}</h1>
  <p style="color:#6b7280;margin:0 0 16px;">${businessName}</p>
  <p>${message}</p>
  ${table}
  ${button}
  <p style="margin-top:24px;font-size:12px;color:#9ca3af;">You are receiving this because your account is configured to receive this notification.</p>`;
  const dataText = data
    ? '\n' +
      Object.entries(data)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : '';
  const bodyText = `${subject}\n${businessName}\n\n${message}${dataText}${link ? `\n\nView: ${link}` : ''}\n\nYou are receiving this because your account is configured to receive this notification.`;
  return layout(subject, bodyHtml, bodyText);
}

export function lowStockNotificationTemplate(params: {
  businessName: string;
  productName: string;
  currentStock: number;
  minStock: number;
  branchName: string;
  link?: string;
}) {
  return businessNotificationTemplate(
    `Low stock alert - ${BRAND}`,
    `Product stock has fallen below the minimum threshold.`,
    params.businessName,
    params.link,
    {
      Product: params.productName,
      'Current stock': params.currentStock,
      'Minimum stock': params.minStock,
      Branch: params.branchName,
    },
  );
}

export function invoiceNotificationTemplate(params: {
  businessName: string;
  invoiceNumber: string;
  total: string;
  customerName?: string;
  link?: string;
}) {
  return businessNotificationTemplate(
    `New invoice - ${BRAND}`,
    `A new official invoice has been created.`,
    params.businessName,
    params.link,
    {
      Invoice: params.invoiceNumber,
      Total: params.total,
      Customer: params.customerName ?? 'Walk-in',
    },
  );
}
